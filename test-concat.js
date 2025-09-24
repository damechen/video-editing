import FormData from 'form-data'
import fs from 'fs'
import fetch from 'node-fetch'

async function testConcatEndpoint() {
    const serverUrl = 'http://localhost:3000/concat-videos'
    
    // Check if video files exist
    const videoFiles = ['./mov_bbb.mp4', './mov_bbb.mp4']
    
    for (const file of videoFiles) {
        if (!fs.existsSync(file)) {
            console.error(`Video file ${file} not found`)
            return
        }
    }
    
    try {
        // Create form data
        const formData = new FormData()
        
        // Add video files to form data
        videoFiles.forEach((filePath, index) => {
            const fileStream = fs.createReadStream(filePath)
            formData.append('videos', fileStream, `video_${index}.webm`)
        })
        
        console.log('Sending request to concatenate videos...')
        
        // Send request
        const response = await fetch(serverUrl, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        })
        
        console.log('Response status:', response.status)
        console.log('Response headers:', response.headers.raw())
        
        if (response.ok) {
            // Save the concatenated video
            const buffer = await response.arrayBuffer()
            const outputPath = './test_concatenated.mp4'
            fs.writeFileSync(outputPath, Buffer.from(buffer))
            console.log(`✅ Success! Concatenated video saved as: ${outputPath}`)
            console.log(`File size: ${buffer.length} bytes`)
        } else {
            const errorText = await response.text()
            console.error('❌ Error response:', errorText)
        }
        
    } catch (error) {
        console.error('❌ Request failed:', error.message)
    }
}

async function testPromptVideoEndpoint() {
    const serverUrl = 'https://video-editing-1.onrender.com/create-prompt-video'
    
    // Check if video files exist
    const videoUrl = 'http://stream.mux.com/V00lHajD02rmT2bExmWF9o901sPnyCL63vL1ux00XJGooIs/medium.mp4'
    const prompts = [
        {
            text: 'Tell us about yourself',
            startTime: 0
        },
        {
            text: 'What convinced you to sign up to Testimonial.to?',
            startTime: 18.712071
        },
        {
            text: 'What results have you experienced?',
            startTime: 50.814481
        },
        {
            text: 'Do you recommend our product?',
            startTime: 81.541201
        }
    ]

    // Send request
    const response = await fetch(serverUrl, {
        method: 'POST',
        body: JSON.stringify({ videoUrl, prompts }),
        headers: {
            'Content-Type': 'application/json'
        }
    })

    console.log('Response status:', response.status)
    console.log('Response headers:', response.headers.raw())
    
    if (response.ok) {
        // Save the concatenated video
        const buffer = await response.arrayBuffer()
        const outputPath = './test_prompt_video.mp4'
        fs.writeFileSync(outputPath, Buffer.from(buffer))
        console.log(`✅ Success! Prompt video saved as: ${outputPath}`)
        console.log(`File size: ${buffer.length} bytes`)
    }
    else {
        const errorText = await response.text()
        console.error('❌ Error response:', errorText)
    }
}

// Run the test
// testConcatEndpoint()
testPromptVideoEndpoint()