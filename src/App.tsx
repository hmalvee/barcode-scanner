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
      
      // First, request camera permission by trying to access it
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        // Stop the stream immediately, we just needed permission
        stream.getTracks().forEach(track => track.stop())
      } catch (permErr) {
        throw new Error('Camera permission denied. Please allow camera access and try again.')
      }

      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserMultiFormatReader()
      }

      const devices = await codeReaderRef.current.listVideoInputDevices()
      
      if (devices.length === 0) {
        throw new Error('No camera devices found. Please connect a camera and refresh the page.')
      }

      const cameraList: CameraDevice[] = devices.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${devices.indexOf(device) + 1}`
      }))

      setAvailableCameras(cameraList)
      setSelectedCameraId(cameraList[0].deviceId)
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

      // Ensure video element has proper attributes
      const video = videoRef.current
      video.setAttribute('autoplay', 'true')
      video.setAttribute('playsinline', 'true')
      video.setAttribute('muted', 'true')

      setScanStatus('Initializing camera...')

      // Wait for video to be ready
      const waitForVideo = () => {
        return new Promise<void>((resolve) => {
          if (video.readyState >= 2) {
            resolve()
          } else {
            video.onloadedmetadata = () => resolve()
            // Timeout after 5 seconds
            setTimeout(() => resolve(), 5000)
          }
        })
      }

      await waitForVideo()
      setScanStatus('Ready - Point camera at barcode')

      // Start decoding with better configuration
      codeReaderRef.current.decodeFromVideoDevice(
        deviceId,
        video,
        (result, err) => {
          if (result) {
            const text = result.getText()
            console.log('Barcode detected:', text)
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
              setTimeout(() => {
                video.style.border = 'none'
                setScanStatus('Ready - Point camera at barcode')
              }, 1000)
            } else {
              setScanStatus('Duplicate barcode - already scanned')
              setTimeout(() => {
                setScanStatus('Ready - Point camera at barcode')
              }, 1000)
            }
          }
          if (err) {
            const errorName = (err as any).name
            // Only log non-expected errors
            if (errorName && 
                !errorName.includes('NotFoundError') && 
                !errorName.includes('No QR Code') &&
                !errorName.includes('NotFoundException')) {
              console.error('Scan error:', err)
            }
          }
        }
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start camera'
      setError(errorMessage)
      setIsScanning(false)
      console.error('Start scanning error:', err)
    }
  }

  const stopScanning = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset()
      setIsScanning(false)
      setScanStatus('')
    }
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
            <button onClick={stopScanning} className="btn btn-secondary">
              Stop Scanning
            </button>
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
