import editly from 'editly'
import { execa } from 'execa'
import fs from 'fs'
import path from 'path'

export async function getVideoDimensions(videoPath) {
    try {
        const { stdout } = await execa('ffprobe', [
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height',
            '-of', 'csv=p=0',
            videoPath
        ])
        const [width, height] = stdout.trim().split(',').map(Number)
        return { width, height }
    } catch (error) {
        console.error('Error getting video dimensions:', error)
        // Fallback to default dimensions
        return { width: 720, height: 1280 }
    }
}

export async function createPromptVideo(options = {}) {
    const {
        outPath = "./output.mp4",
        promptText = "What do you like about this product?",
        videos = ["./mov_bbb.mp4"],
        audioPath = "./sound.mp3"
    } = options

    const clips = []
    
    // Add initial prompt
    clips.push({
        duration: 5,
        layers: [
            {
                type: "title-background",
                text: promptText,
                background: { type: "linear-gradient", colors: ["#667eea", "#764ba2"] },
            },
            {
                type: "audio",
                path: audioPath
            }
        ],
    })

    // Add videos with prompts between them
    videos.forEach((videoPath, index) => {
        // Add video
        clips.push({
            layers: [
                {
                    type: "video",
                    path: videoPath,
                }
            ]
        })

        // Add prompt after each video (except the last one)
        if (index < videos.length - 1) {
            clips.push({
                duration: 5,
                layers: [
                    {
                        type: "title-background",
                        text: promptText,
                        background: { type: "linear-gradient", colors: ["#667eea", "#764ba2"] },
                    },
                ],
            })
        }
    })

    const result = await editly({
        outPath,
        defaults: {
            transition: { name: "random" },
        },
        keepSourceAudio: true,
        clips
    })

    return result
}

export async function concatenateVideos(videoPaths, outputPath = "./concatenated.mp4") {
    // Create a temporary file list for ffmpeg concat
    const tempDir = './temp'
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
    }
    
    const fileListPath = path.join(tempDir, `filelist_${Date.now()}.txt`)
    
    try {
        // Create file list content for ffmpeg concat demuxer
        const fileListContent = videoPaths
            .map(videoPath => `file '${path.resolve(videoPath)}'`)
            .join('\n')
        
        // Write the file list
        fs.writeFileSync(fileListPath, fileListContent)
        
        // Run ffmpeg concat
        const { stdout, stderr } = await execa('ffmpeg', [
            '-f', 'concat',           // Use concat demuxer
            '-safe', '0',             // Allow absolute paths
            '-i', fileListPath,       // Input file list
            '-c', 'copy',             // Copy streams without re-encoding
            '-y',                     // Overwrite output file
            outputPath
        ])
        
        console.log('FFmpeg concat completed successfully')
        if (stderr) console.log('FFmpeg stderr:', stderr)
        
        return { success: true, outputPath, stdout, stderr }
        
    } catch (error) {
        console.error('Error concatenating videos:', error)
        throw new Error(`Video concatenation failed: ${error.message}`)
    } finally {
        // Clean up temp file list
        if (fs.existsSync(fileListPath)) {
            fs.unlinkSync(fileListPath)
        }
    }
}

export async function splitVideo(videoPath, prompts) {
    if (!prompts || prompts.length === 0) {
        throw new Error('Prompts array is required and cannot be empty')
    }

    // Create temp directory for split videos
    const tempDir = './temp'
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
    }

    const splitVideos = []
    
    try {
        // Get total video duration first
        const { stdout: durationOutput } = await execa('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            videoPath
        ])
        const totalDuration = parseFloat(durationOutput.trim())

        // Process each prompt to create video segments
        for (let i = 0; i < prompts.length; i++) {
            const currentPrompt = prompts[i]
            const nextPrompt = prompts[i + 1]
            
            // Determine start time (0 if undefined for first clip)
            const startTime = currentPrompt.startTime || 0
            
            // Determine end time (next prompt's startTime or total duration)
            const endTime = nextPrompt?.startTime || totalDuration
            
            // Calculate duration for this segment
            const duration = endTime - startTime
            
            if (duration <= 0) {
                console.warn(`Skipping segment ${i} with invalid duration: ${duration}`)
                continue
            }

            // Generate output filename for this segment
            const segmentPath = path.join(tempDir, `segment_${i}_${Date.now()}.mp4`)
            
            console.log(`Creating segment ${i}: ${startTime}s to ${endTime}s (duration: ${duration}s)`)
            
            // Use FFmpeg to extract the segment with high-quality re-encoding
            const ffmpegArgs = [
                '-ss', startTime.toString(), // Seek before input for better performance
                '-i', videoPath,           // Input video
                '-t', duration.toString(), // Duration from seek point
                '-c:v', 'libx264',         // Video codec
                '-crf', '18',              // High quality (lower = better quality, 18 is visually lossless)
                '-preset', 'medium',       // Balanced speed/compression
                '-c:a', 'aac',             // Audio codec
                '-b:a', '128k',            // Audio bitrate
                '-avoid_negative_ts', 'make_zero',
                '-y',                      // Overwrite output file
                segmentPath
            ]
            
            console.log('FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '))
            
            const result = await execa('ffmpeg', ffmpegArgs)
            console.log(`Segment ${i} created successfully`)
            if (result.stderr) {
                console.log('FFmpeg stderr:', result.stderr)
            }
            
            splitVideos.push({
                segmentPath,
                startTime,
                endTime,
                duration,
                promptIndex: i,
                prompt: currentPrompt
            })
        }

        console.log(`Successfully split video into ${splitVideos.length} segments`)
        
        // Return just the filenames of the split videos
        return splitVideos.map(segment => segment.segmentPath)

    } catch (error) {
        console.error('Error splitting video:', error)
        
        // Clean up any created segments on error
        splitVideos.forEach(({ segmentPath }) => {
            if (fs.existsSync(segmentPath)) {
                fs.unlinkSync(segmentPath)
            }
        })
        
        throw new Error(`Video splitting failed: ${error.message}`)
    }
}
