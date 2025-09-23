import express from 'express'
import multer from 'multer'
import { concatenateVideos, getVideoDimensions, splitVideo } from './utils/videoProcessing.js'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import editly from 'editly'
import axios from 'axios'
import os from 'os'

const app = express()
const PORT = process.env.PORT || 3003

// Configure multer for video file uploads with unique filenames
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 10 // Maximum 10 files (reduced for better performance)
  },
  fileFilter: (req, file, cb) => {
    // Accept video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('Only video files are allowed'), false)
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename using UUID
    const uniqueName = `${crypto.randomUUID()}-${file.originalname}`
    cb(null, uniqueName)
  }
})

// Middleware to parse JSON bodies
app.use(express.json())

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true })
}

// Health check endpoint for Render.com
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Video Prompt Server is running'
  })
})

// OPTIONS endpoint for CORS preflight requests on concat-videos
app.options('/concat-videos', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.status(200).end()
})

// Cleanup utility function
const cleanupFiles = (filePaths) => {
  filePaths.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (error) {
      console.error(`Failed to cleanup file ${filePath}:`, error)
    }
  })
}

// POST endpoint for concatenating videos with improved concurrency handling
app.post('/concat-videos', upload.array('videos'), async (req, res) => {
  // Set CORS headers to allow access from any origin
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  const requestId = crypto.randomUUID()
  const uploadedFiles = req.files || []
  let outputPath = null

  try {
    // Validate that we have files
    if (uploadedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No video files provided'
      })
    }

    if (uploadedFiles.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 videos are required for concatenation'
      })
    }

    console.log(`[${requestId}] Processing ${uploadedFiles.length} video files`)

    // Extract file paths
    const videoPaths = uploadedFiles.map(file => file.path)

    // Generate unique output filename using UUID
    outputPath = `./output/concatenated_${requestId}.mp4`

    // Ensure output directory exists
    if (!fs.existsSync('./output')) {
      fs.mkdirSync('./output', { recursive: true })
    }

    // Concatenate videos using FFmpeg
    await concatenateVideos(videoPaths, outputPath)

    // Clean up uploaded files immediately after processing
    cleanupFiles(videoPaths)

    // Send the concatenated video file
    const downloadFilename = `concatenated_${Date.now()}.mp4`
    res.download(outputPath, downloadFilename, (err) => {
      if (err) {
        console.error(`[${requestId}] Error sending file:`, err)
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Error sending concatenated video'
          })
        }
      } else {
        console.log(`[${requestId}] File sent successfully`)
      }

      // Clean up output file after sending
      setTimeout(() => {
        cleanupFiles([outputPath])
      }, 10000) // Wait 10 seconds before cleanup to ensure download completes
    })

  } catch (error) {
    console.error(`[${requestId}] Concatenation error:`, error)

    // Clean up all files on error
    const filesToCleanup = [...uploadedFiles.map(f => f.path)]
    if (outputPath) filesToCleanup.push(outputPath)
    cleanupFiles(filesToCleanup)

    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    })
  }
})

// POST endpoint for creating prompt videos
app.post('/create-prompt-video', async (req, res) => {
  try {
    const { videoUrl, prompts } = req.body

    // Download the video from videoUrl and save it to a temporary file
    const response = await axios.get(videoUrl, { responseType: 'arraybuffer' })
    const buffer = Buffer.from(response.data)
    const tempFilePath = path.join(os.tmpdir(), `${crypto.randomUUID()}-${videoUrl.split('/').pop()}`)
    fs.writeFileSync(tempFilePath, buffer)

    // Now we need to split the video into chunks based on prompts[].start using ffmpeg
    const downloadedVideoFiles = (await splitVideo(tempFilePath, prompts)).map((file, index) => {
      return {
        path: file,
        prompt: prompts[index].text
      }
    })

    const outputPath = path.join(os.tmpdir(), `${crypto.randomUUID()}.mp4`)
    const clips = downloadedVideoFiles.map(file => {
      return [
        {
          duration: Math.ceil((file.prompt.length / 10)),
          layers: [
            {
              type: "title-background",
              text: file.prompt,
              background: { type: "linear-gradient", colors: ["#667eea", "#764ba2"] },
            }
          ],
        },
        {
          layers: [
            {
              type: "video",
              path: file.path,
            }
          ]
        },
      ]
    }).flat()


    const video = await editly({
      outPath: outputPath,
      defaults: {
        transition: { name: "random" },
      },
      keepSourceAudio: true,
      clips,
    })

    // Clean up temporary files
    // cleanupFiles([tempFilePath, ...downloadedVideoFiles.map(file => file.path)])

    // Send the video file
    res.download(outputPath, `${crypto.randomUUID()}.mp4`, (err) => {
      if (err) {
        console.error(`Error sending file:`, err)
        res.status(500).json({
          success: false,
          error: 'Error sending video'
        })
      }
    })

    // Clean up output file after sending
    // setTimeout(() => {
    //   cleanupFiles([outputPath])
    // }, 10000) // Wait 10 seconds before cleanup to ensure download completes
  } catch (error) {
    console.error('Error creating prompt video:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app
