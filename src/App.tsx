import { useState, useEffect, useRef } from 'react'
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library'
import './App.css'

interface ScannedCode {
  id: string
  text: string
  timestamp: Date
}

interface CameraDevice {
  deviceId: string
  label: string
}

function App() {
  const [scannedCodes, setScannedCodes] = useState<ScannedCode[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [scanStatus, setScanStatus] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)

  useEffect(() => {
    // Configure the reader with hints for better detection
    const hints = new Map()
    hints.set(DecodeHintType.TRY_HARDER, true)
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.CODABAR,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.PDF_417,
      BarcodeFormat.AZTEC
    ])
    
    codeReaderRef.current = new BrowserMultiFormatReader(hints)
    loadCameras()
    
    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset()
      }
    }
  }, [])

  const loadCameras = async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (!codeReaderRef.current) {
        const hints = new Map()
        hints.set(DecodeHintType.TRY_HARDER, true)
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.CODABAR,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.PDF_417,
          BarcodeFormat.AZTEC
        ])
        codeReaderRef.current = new BrowserMultiFormatReader(hints)
      }

      // Request camera permission with back camera preference for mobile
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' }, // Prefer back camera
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        // Stop the stream immediately, we just needed permission
        stream.getTracks().forEach(track => track.stop())
      } catch (permErr) {
        throw new Error('Camera permission denied. Please allow camera access and try again.')
      }

      const devices = await codeReaderRef.current.listVideoInputDevices()
      
      if (devices.length === 0) {
        throw new Error('No camera devices found. Please connect a camera and refresh the page.')
      }

      const cameraList: CameraDevice[] = devices.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${devices.indexOf(device) + 1}`
      }))

      // Prefer back camera (environment) - usually labeled with "back" or "rear" or is the last one
      let preferredCamera = cameraList[0]
      const backCamera = cameraList.find(cam => 
        cam.label.toLowerCase().includes('back') || 
        cam.label.toLowerCase().includes('rear') ||
        cam.label.toLowerCase().includes('environment')
      )
      
      if (backCamera) {
        preferredCamera = backCamera
      } else if (cameraList.length > 1) {
        // On mobile, back camera is often the last one
        preferredCamera = cameraList[cameraList.length - 1]
      }

      setAvailableCameras(cameraList)
      setSelectedCameraId(preferredCamera.deviceId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to detect cameras'
      setError(errorMessage)
      console.error('Camera detection error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const startScanning = async () => {
    if (!codeReaderRef.current || !videoRef.current) return

    try {
      setError(null)
      setIsScanning(true)
      setScanStatus('Starting camera...')

      // Reload cameras if none are available
      if (availableCameras.length === 0) {
        await loadCameras()
        if (availableCameras.length === 0) {
          throw new Error('No cameras available. Please check your camera connection.')
        }
      }

      const deviceId = selectedCameraId || availableCameras[0]?.deviceId

      if (!deviceId) {
        throw new Error('No camera device selected')
      }

      const video = videoRef.current
      
      // Use optimal video constraints for mobile with higher resolution and autofocus
      const videoConstraints: MediaTrackConstraints = {
        deviceId: { exact: deviceId },
        facingMode: { ideal: 'environment' }, // Prefer back camera
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 }
      }
      
      // Try to enable autofocus (may not work on all devices)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: videoConstraints 
        })
        const track = stream.getVideoTracks()[0]
        if (track && 'getCapabilities' in track) {
          const capabilities = track.getCapabilities() as any
          if (capabilities && capabilities.focusMode && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
            try {
              await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] })
            } catch (constraintErr) {
              // Autofocus not supported, continue without it
              console.log('Autofocus not available on this device')
            }
          }
        }
        video.srcObject = stream
      } catch (streamErr) {
        // Fallback to simpler constraints
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
          video: { deviceId: { exact: deviceId }, facingMode: { ideal: 'environment' } }
        })
        video.srcObject = fallbackStream
      }

      video.setAttribute('autoplay', 'true')
      video.setAttribute('playsinline', 'true')
      video.setAttribute('muted', 'true')
      
      // Wait for video to be ready (reduced timeout for faster startup)
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) {
          resolve()
        } else {
          const onLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata)
            resolve()
          }
          video.addEventListener('loadedmetadata', onLoadedMetadata)
          // Reduced timeout to 3 seconds
          setTimeout(() => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata)
            resolve()
          }, 3000)
        }
      })

      setScanStatus('Ready - Point camera at barcode')

      // Start decoding with continuous scanning
      let lastScanTime = 0
      const scanCooldown = 1500 // Prevent duplicate scans within 1.5 seconds
      let scanAttempts = 0

      // Use decodeFromVideoDevice with better error handling
      // Note: ZXing scans continuously, so we don't need manual intervals
      codeReaderRef.current.decodeFromVideoDevice(
        deviceId,
        video,
        (result, err) => {
          scanAttempts++
          
          if (result) {
            const now = Date.now()
            const text = result.getText()
            
            // Prevent rapid duplicate scans
            if (now - lastScanTime < scanCooldown && scannedCodes.some(code => code.text === text)) {
              return
            }
            
            lastScanTime = now
            console.log('✅ Barcode detected:', text, 'Format:', result.getBarcodeFormat())
            setScanStatus('Barcode detected!')
            
            // Check if this barcode was already scanned (avoid duplicates)
            const isDuplicate = scannedCodes.some(code => code.text === text)
            
            if (!isDuplicate) {
              const newCode: ScannedCode = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                text,
                timestamp: new Date()
              }
              setScannedCodes(prev => [...prev, newCode])
              
              // Visual feedback - briefly highlight
              video.style.border = '4px solid #4caf50'
              video.style.boxShadow = '0 0 20px #4caf50'
              setTimeout(() => {
                video.style.border = 'none'
                video.style.boxShadow = 'none'
                setScanStatus('Ready - Point camera at barcode')
              }, 800)
            } else {
              setScanStatus('Already scanned')
              setTimeout(() => {
                setScanStatus('Ready - Point camera at barcode')
              }, 800)
            }
          }
          
          if (err) {
            const errorName = (err as any).name
            // Log errors for debugging (but not the common "not found" errors)
            if (errorName && 
                !errorName.includes('NotFoundError') && 
                !errorName.includes('No QR Code') &&
                !errorName.includes('NotFoundException') &&
                !errorName.includes('No MultiFormat Readers')) {
              // Log every 50th attempt to avoid spam
              if (scanAttempts % 50 === 0) {
                console.log('Scan attempt', scanAttempts, ':', errorName)
              }
            }
          }
        }
      )
      
      // Log that scanning has started
      console.log('📷 Barcode scanning started with device:', deviceId)
      console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start camera'
      setError(errorMessage)
      setIsScanning(false)
      setScanStatus('')
      console.error('Start scanning error:', err)
    }
  }

  const stopScanning = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset()
    }
    
    // Stop video stream
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    
    setIsScanning(false)
    setScanStatus('')
  }

  const copyAll = async () => {
    if (scannedCodes.length === 0) return

    const allText = scannedCodes.map(code => code.text).join('\n')
    
    try {
      await navigator.clipboard.writeText(allText)
      alert(`Copied ${scannedCodes.length} barcode(s) to clipboard!`)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = allText
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        alert(`Copied ${scannedCodes.length} barcode(s) to clipboard!`)
      } catch (fallbackErr) {
        alert('Failed to copy to clipboard')
      }
      document.body.removeChild(textArea)
    }
  }

  const clearAll = () => {
    setScannedCodes([])
  }

  const removeCode = (id: string) => {
    setScannedCodes(prev => prev.filter(code => code.id !== id))
  }

  return (
    <div className="app">
      <div className="scanner-container">
        <h1>Barcode Scanner</h1>
        
        <div className="video-wrapper">
          <video
            ref={videoRef}
            className="video-preview"
            autoPlay
            playsInline
            muted
            style={{ display: isScanning ? 'block' : 'none' }}
          />
          {isScanning && (
            <div className="scanning-overlay">
              <div className="scanning-line"></div>
              <p className="scanning-text">{scanStatus || 'Point camera at barcode'}</p>
            </div>
          )}
          {!isScanning && (
            <div className="video-placeholder">
              <p>Click "Start Scanning" to begin</p>
              <p className="mobile-hint">Using back camera on mobile</p>
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        {availableCameras.length > 1 && !isScanning && (
          <div className="camera-selector">
            <label htmlFor="camera-select">Select Camera:</label>
            <select
              id="camera-select"
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="camera-select"
            >
              {availableCameras.map((camera) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="controls">
          {!isScanning ? (
            <>
              <button 
                onClick={startScanning} 
                className="btn btn-primary"
                disabled={isLoading || availableCameras.length === 0}
              >
                {isLoading ? 'Detecting Camera...' : 'Start Scanning'}
              </button>
              {availableCameras.length === 0 && (
                <button onClick={loadCameras} className="btn btn-secondary">
                  Refresh Cameras
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={stopScanning} className="btn btn-secondary">
                Stop Scanning
              </button>
              <div className="scan-tips">
                <p>💡 Tips: Hold steady, ensure good lighting, keep barcode flat</p>
              </div>
            </>
          )}
        </div>

        <div className="scanned-list-container">
          <div className="scanned-list-header">
            <h2>Scanned Barcodes ({scannedCodes.length})</h2>
            {scannedCodes.length > 0 && (
              <div className="header-actions">
                <button onClick={copyAll} className="btn btn-copy">
                  Copy All
                </button>
                <button onClick={clearAll} className="btn btn-clear">
                  Clear All
                </button>
              </div>
            )}
          </div>
          
          <div className="scanned-list">
            {scannedCodes.length === 0 ? (
              <div className="empty-state">
                <p>No barcodes scanned yet</p>
              </div>
            ) : (
              scannedCodes.map((code) => (
                <div key={code.id} className="scanned-item">
                  <div className="scanned-item-content">
                    <span className="scanned-text">{code.text}</span>
                    <span className="scanned-time">
                      {code.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <button
                    onClick={() => removeCode(code.id)}
                    className="btn-remove"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
