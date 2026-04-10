/**
 * Adds ToonlyReels watermark and creator outro to a video using Canvas API
 */

export interface WatermarkController {
  cancel: () => void;
  promise: Promise<Blob>;
}

export function addWatermarkToVideo(
  videoBlob: Blob,
  creatorUsername: string,
  onProgress?: (progress: number) => void
): WatermarkController {
  let cancelled = false;
  let mediaRecorder: MediaRecorder | null = null;
  let video: HTMLVideoElement | null = null;

  const promise = new Promise<Blob>((resolve, reject) => {
    video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    video.src = URL.createObjectURL(videoBlob);
    video.muted = true;
    
    video.onloadedmetadata = () => {
      if (cancelled || !video) {
        reject(new Error('Download cancelled'));
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const stream = canvas.captureStream(30); // 30 FPS
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000
      });
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        if (cancelled) {
          reject(new Error('Download cancelled'));
          return;
        }
        const watermarkedBlob = new Blob(chunks, { type: 'video/webm' });
        if (video) URL.revokeObjectURL(video.src);
        resolve(watermarkedBlob);
      };
      
      mediaRecorder.start();
      video.play();
      
      const drawFrame = () => {
        if (cancelled || !video) {
          mediaRecorder?.stop();
          return;
        }

        if (video.paused || video.ended) {
          mediaRecorder?.stop();
          return;
        }
        
        // Report progress
        if (onProgress && video.duration) {
          const progress = Math.floor((video.currentTime / video.duration) * 100);
          onProgress(progress);
        }
        
        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Calculate if we're in the outro (last 2 seconds)
        const isOutro = video.duration - video.currentTime <= 2;
        
        if (isOutro) {
          // Draw outro with creator username
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
          
          ctx.font = 'bold 32px Arial';
          ctx.fillStyle = 'white';
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          
          ctx.fillText('ToonlyReels', canvas.width / 2, canvas.height - 60);
          
          ctx.font = '24px Arial';
          ctx.fillText(`@${creatorUsername}`, canvas.width / 2, canvas.height - 25);
        } else {
          // Draw watermark in bottom-left corner
          ctx.font = 'bold 24px Arial';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 3;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          ctx.textAlign = 'left';
          ctx.fillText('ToonlyReels', 10, canvas.height - 10);
        }
        
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        requestAnimationFrame(drawFrame);
      };
      
      video.addEventListener('play', () => {
        drawFrame();
      });
    };
    
    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };
  });

  return {
    cancel: () => {
      cancelled = true;
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      if (video) {
        video.pause();
        URL.revokeObjectURL(video.src);
      }
    },
    promise
  };
}
