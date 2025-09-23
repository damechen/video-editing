import editly from 'editly'
import { execa } from 'execa'

async function getVideoDimensions(videoPath) {
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

async function main() {
    // Get dimensions from video_0.webm
    // const { width, height } = await getVideoDimensions('./video_0.webm')
    // console.log(`Using video dimensions: ${width}x${height}`)

    const video = await editly({
        outPath: "./commonFeatures.mp4",
        defaults: {
            transition: { name: "random" },
        },
        keepSourceAudio: true,
        clips: [
            // Prompt question for 5 seconds
            {
                duration: 5,
                layers: [
                    {
                        type: "title-background",
                        text: "What do you like about this product?",
                        background: { type: "linear-gradient", colors: ["#667eea", "#764ba2"] },
                    },
                    {
                      type: "audio",
                      path: "./sound.mp3"
                    }
                ],
            },
            // Video 0
            {
                layers: [
                    {
                        type: "video",
                        path: "./mov_bbb.mp4",
                    }
                ]
            },
            // Prompt question for 5 seconds
            {
                duration: 5,
                layers: [
                    {
                        type: "title-background",
                        text: "What do you like about this product?",
                        background: { type: "linear-gradient", colors: ["#667eea", "#764ba2"] },
                    },
                ],
            },
            // Video 1
            {
                layers: [
                    {
                        type: "video",
                        path: "./mov_bbb.mp4"
                    },
                    {
                      type: "audio",
                      path: "./sound.mp3"
                    }
                ]
            },
            // Prompt question for 5 seconds
            {
                duration: 5,
                layers: [
                    {
                        type: "title-background",
                        text: "What do you like about this product?",
                        background: { type: "linear-gradient", colors: ["#667eea", "#764ba2"] },
                    },
                ],
            },
            // Video 2
            {
                layers: [
                    {
                        type: "video",
                        path: "./mov_bbb.mp4"
                    },
                    {
                      type: "audio",
                      path: "./sound.mp3"
                    }
                ]
            },
        ],
    })

    console.log(video)
}

main()