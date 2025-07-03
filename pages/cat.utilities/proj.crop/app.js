const CropTool = () => {
  // State management
  const [currentImage, setCurrentImage] = useState(null);
  const [currentFileType, setCurrentFileType] = useState('image/jpeg');
  const [aspectRatio, setAspectRatio] = useState(968/600);
  const [customAspectRatio, setCustomAspectRatio] = useState(null);
  const [displayTargetWidth, setDisplayTargetWidth] = useState(0);
  const [displayTargetHeight, setDisplayTargetHeight] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [userZoom, setUserZoom] = useState(1);
  const [coverScale, setCoverScale] = useState(1);
  const [hasManuallyAdjustedZoom, setHasManuallyAdjustedZoom] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [batchQueue, setBatchQueue] = useState([]);
  const [croppedResults, setCroppedResults] = useState([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [exportWidth, setExportWidth] = useState(968);
  const [exportHeight, setExportHeight] = useState(600);
  const [filename, setFilename] = useState('');
  const [showControls, setShowControls] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Refs
  const previewRef = useRef(null);
  const cropAreaRef = useRef(null);
  const previewContainerRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // ResizeObserver to get actual container dimensions
  useEffect(() => {
    if (!previewContainerRef.current) return;

    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === previewContainerRef.current) {
          setContainerWidth(entry.contentRect.width);
          setContainerHeight(entry.contentRect.height);
        }
      }
    });

    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update crop area dimensions based on container size and aspect ratio
  const updateCropAreaDimensions = useCallback(() => {
    if (containerWidth === 0 || containerHeight === 0) return;

    let newDisplayTargetWidth;
    let newDisplayTargetHeight;

    const maxContainerHeight = 500;

    const testWidth1 = containerWidth;
    const testHeight1 = containerWidth / aspectRatio;

    const testHeight2 = Math.min(containerHeight, maxContainerHeight);
    const testWidth2 = testHeight2 * aspectRatio;

    if (testWidth2 <= containerWidth && testHeight2 <= containerHeight) {
        newDisplayTargetWidth = testWidth2;
        newDisplayTargetHeight = testHeight2;
    } else {
        newDisplayTargetWidth = testWidth1;
        newDisplayTargetHeight = testHeight1;
        if (newDisplayTargetHeight > Math.min(containerHeight, maxContainerHeight)) {
            newDisplayTargetHeight = Math.min(containerHeight, maxContainerHeight);
            newDisplayTargetWidth = newDisplayTargetHeight * aspectRatio;
        }
    }
    
    newDisplayTargetWidth = Math.min(newDisplayTargetWidth, containerWidth);
    newDisplayTargetHeight = Math.min(newDisplayTargetHeight, containerHeight, maxContainerHeight);

    setDisplayTargetWidth(Math.round(newDisplayTargetWidth));
    setDisplayTargetHeight(Math.round(newDisplayTargetHeight));
    setOffsetX(0);
    setOffsetY(0);
    setHasManuallyAdjustedZoom(false);
  }, [aspectRatio, containerWidth, containerHeight]);

  // Update preview
  const updatePreview = useCallback(() => {
    if (!currentImage || !previewRef.current || displayTargetWidth === 0 || displayTargetHeight === 0) return;

    const rad = Math.abs(currentRotation * Math.PI / 180);
    const rotatedImgWidth = currentImage.naturalWidth * Math.cos(rad) + currentImage.naturalHeight * Math.sin(rad);
    const rotatedImgHeight = currentImage.naturalWidth * Math.sin(rad) + currentImage.naturalHeight * Math.cos(rad);
    
    const newCoverScale = Math.max(displayTargetWidth / rotatedImgWidth, displayTargetHeight / rotatedImgHeight);
    setCoverScale(newCoverScale);

    if (!hasManuallyAdjustedZoom) {
      setUserZoom(newCoverScale);
    } else {
      setUserZoom(prev => Math.max(prev, newCoverScale));
    }

    const finalScale = hasManuallyAdjustedZoom ? Math.max(userZoom, newCoverScale) : newCoverScale;
    
    previewRef.current.style.transition = isDragging ? "none" : "transform 0.1s ease";
    previewRef.current.style.width = currentImage.naturalWidth + "px";
    previewRef.current.style.height = currentImage.naturalHeight + "px";
    previewRef.current.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) scale(${finalScale}) rotate(${currentRotation}deg)`;
  }, [currentImage, displayTargetWidth, displayTargetHeight, currentRotation, userZoom, offsetX, offsetY, isDragging, hasManuallyAdjustedZoom]);

  // Constrain offsets
  const constrainOffsets = useCallback(() => {
    if (!currentImage || displayTargetWidth === 0 || displayTargetHeight === 0) return;
    const finalScale = hasManuallyAdjustedZoom ? Math.max(userZoom, coverScale) : userZoom;
    const w = currentImage.naturalWidth * finalScale;
    const h = currentImage.naturalHeight * finalScale;
    const rad = currentRotation * Math.PI / 180;
    const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
    const bbWidth = w * cos + h * sin;
    const bbHeight = w * sin + h * cos;

    const minOffsetX = (displayTargetWidth - bbWidth) / 2;
    const maxOffsetX = (bbWidth - displayTargetWidth) / 2;
    const minOffsetY = (displayTargetHeight - bbHeight) / 2;
    const maxOffsetY = (bbHeight - displayTargetHeight) / 2;

    setOffsetX(prev => Math.min(Math.max(prev, minOffsetX), maxOffsetX));
    setOffsetY(prev => Math.min(Math.max(prev, minOffsetY), maxOffsetY));
  }, [currentImage, userZoom, currentRotation, displayTargetWidth, displayTargetHeight, hasManuallyAdjustedZoom, coverScale]);

  // Handle file drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const dt = e.dataTransfer;
    let files = [];
    
    if (dt.items) {
      for (let i = 0; i < dt.items.length; i++) {
        if (dt.items[i].kind === 'file') {
          let file = dt.items[i].getAsFile();
          if (file && file.type.startsWith("image/")) {
            files.push(file);
          }
        }
      }
    } else if (dt.files) {
      for (let i = 0; i < dt.files.length; i++) {
        if (dt.files[i].type.startsWith("image/")) {
          files.push(dt.files[i]);
        }
      }
    }

    if (files.length > 0) {
      setBatchQueue(files);
      setCroppedResults([]);
      setIsBatchMode(files.length > 1);
      loadNextImage(files);
    }
  }, []);

  // Load next image
  const loadNextImage = useCallback((files = null) => {
    const queue = files || batchQueue;
    if (queue.length === 0) return;
    
    const file = queue[0];
    if (files) { 
      setBatchQueue(queue.slice(1));
    } else { 
      setBatchQueue(prev => prev.slice(1));
    }
    
    setCurrentFileType(file.type);
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        setCurrentImage(img);
        setOffsetX(0);
        setOffsetY(0);
        setCurrentRotation(0);
        setUserZoom(1); 
        setHasManuallyAdjustedZoom(false); 
        setShowControls(true);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, [batchQueue]);

  // Handle mouse events for dragging
  const handleMouseDown = useCallback((e) => {
    if (!currentImage) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }, [currentImage]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setOffsetX(prev => prev + dx);
    setOffsetY(prev => prev + dy);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      constrainOffsets();
    }
  }, [isDragging, constrainOffsets]);

  // Handle export size changes
  const handleExportWidthChange = useCallback((value) => {
    const w = parseInt(value);
    if (!isNaN(w) && w > 0) {
      setExportWidth(w);
      const newRatio = w / exportHeight;
      setAspectRatio(newRatio);
      setCustomAspectRatio(newRatio);
    }
  }, [exportHeight]);

  const handleExportHeightChange = useCallback((value) => {
    const h = parseInt(value);
    if (!isNaN(h) && h > 0) {
      setExportHeight(h);
      const newRatio = exportWidth / h;
      setAspectRatio(newRatio);
      setCustomAspectRatio(newRatio);
    }
  }, [exportWidth]);

  // Get zoom display class
  const getZoomDisplayClass = useCallback((zoom) => {
    if (zoom >= 1.3) return 'zoom-red';
    if (zoom >= 1.01) return 'zoom-orange';
    return '';
  }, []);

  // Double click handlers for sliders
  const handleZoomDoubleClick = useCallback(() => {
    setUserZoom(1);
    setHasManuallyAdjustedZoom(true);
  }, []);

  const handleAspectRatioDoubleClick = useCallback(() => {
    setAspectRatio(968/600);
    setExportWidth(968);
    setExportHeight(600);
    setCustomAspectRatio(null);
  }, []);

  // Download single image
  const downloadImage = useCallback(() => {
    if (!currentImage) return;
    
    const userWord = filename.trim() || 'cropped_image';
    const randomString = Math.floor(1000 + Math.random() * 9000);
    
    const canvas = document.createElement('canvas');
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext('2d');
    
    ctx.save();
    ctx.translate(exportWidth / 2, exportHeight / 2);
    const exportRatioX = exportWidth / displayTargetWidth;
    const exportRatioY = exportHeight / displayTargetHeight;
    
    ctx.translate(offsetX * exportRatioX, offsetY * exportRatioY); 
    ctx.rotate((currentRotation * Math.PI) / 180); 
    const finalScale = hasManuallyAdjustedZoom ? Math.max(userZoom, coverScale) : userZoom;
    ctx.scale(finalScale * exportRatioX, finalScale * exportRatioY); 
    ctx.drawImage(currentImage, -currentImage.naturalWidth / 2, -currentImage.naturalHeight / 2);
    ctx.restore();
    
    const mimeType = currentFileType === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const extension = mimeType.split('/')[1];
    const linkFilename = `${userWord}_${randomString}.${extension}`;
    const link = document.createElement('a');
    link.download = linkFilename;
    link.href = canvas.toDataURL(mimeType, 0.9);
    link.click();
  }, [currentImage, filename, exportWidth, exportHeight, displayTargetWidth, displayTargetHeight, offsetX, offsetY, currentRotation, userZoom, currentFileType, hasManuallyAdjustedZoom, coverScale]);

  // Batch processing
  const processBatchNext = useCallback(() => {
    if (!currentImage) return;
    
    const userWord = filename.trim() || 'cropped_image';
    const randomString = Math.floor(1000 + Math.random() * 9000);
    
    const canvas = document.createElement('canvas');
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext('2d');
    
    ctx.save();
    ctx.translate(exportWidth / 2, exportHeight / 2);
    const exportRatioX = exportWidth / displayTargetWidth;
    const exportRatioY = exportHeight / displayTargetHeight;
    ctx.translate(offsetX * exportRatioX, offsetY * exportRatioY);
    ctx.rotate((currentRotation * Math.PI) / 180);
    const finalScale = hasManuallyAdjustedZoom ? Math.max(userZoom, coverScale) : userZoom;
    ctx.scale(finalScale * exportRatioX, finalScale * exportRatioY);
    ctx.drawImage(currentImage, -currentImage.naturalWidth / 2, -currentImage.naturalHeight / 2);
    ctx.restore();
    
    const dataURL = canvas.toDataURL(currentFileType === 'image/webp' ? 'image/webp' : 'image/jpeg', 0.9);
    setCroppedResults(prev => [...prev, { 
      filename: `${userWord}_${randomString}.${currentFileType.split('/')[1]}`, 
      dataURL 
    }]);
    
    if (batchQueue.length > 0) {
      loadNextImage();
    }
  }, [currentImage, filename, exportWidth, exportHeight, displayTargetWidth, displayTargetHeight, offsetX, offsetY, currentRotation, userZoom, currentFileType, batchQueue, loadNextImage, hasManuallyAdjustedZoom, coverScale]);

  // Download ZIP
  const downloadZip = useCallback(() => {
    if (croppedResults.length === 0) return;
    const zip = new JSZip();
    croppedResults.forEach(item => {
      const base64Data = item.dataURL.split(',')[1];
      zip.file(item.filename, base64Data, { base64: true });
    });
    zip.generateAsync({ type: "blob" }).then(function(content) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = "cropped_images.zip";
      a.click();
    });
  }, [croppedResults]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && currentImage) {
        e.preventDefault();
        if (isBatchMode) {
          if (batchQueue.length > 0) {
            processBatchNext();
          } else {
            downloadZip();
          }
        } else {
          downloadImage();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentImage, isBatchMode, batchQueue.length, processBatchNext, downloadZip, downloadImage]);

  // Mouse event listeners for dragging
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Update crop area dimensions when aspect ratio or container size changes
  useEffect(() => {
    updateCropAreaDimensions();
  }, [updateCropAreaDimensions]);

  // Update preview when relevant state changes
  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  // Constrain offsets when zoom or rotation changes
  useEffect(() => {
    constrainOffsets();
  }, [userZoom, currentRotation, constrainOffsets]);

  return (
    <div className="app-container">
      <div className="header">
        <h1 className="title">ULTIMATE CROP TOOL</h1>
      </div>
      
      <div className="main-content">
        <div className="left-panel">
          {!showControls ? (
            <div 
              className="drop-zone" 
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => e.preventDefault()}
              onDragLeave={(e) => e.preventDefault()}
              ref={previewContainerRef}
            >
              <svg className="drop-icon" viewBox="0 0 24 24">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04ZM14 13V17H10V13H7L12 8L17 13H14Z"/>
              </svg>
              <div className="drop-text">Drop Images Here</div>
              <div className="drop-subtext">Drag from downloads or file explorer</div>
            </div>
          ) : (
            <div 
              className="preview-container" 
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => e.preventDefault()}
              onDragLeave={(e) => e.preventDefault()}
              ref={previewContainerRef}
            >
              <div 
                ref={cropAreaRef}
                className="crop-area" 
                style={{ 
                  width: displayTargetWidth + "px", 
                  height: displayTargetHeight + "px" 
                }}
                onMouseDown={handleMouseDown}
                onWheel={(e) => {
                  e.preventDefault();
                  const step = 0.05;
                  if (e.deltaY < 0) { 
                    setUserZoom(prev => Math.min(prev + step, 2));
                  } else { 
                    setUserZoom(prev => Math.max(prev - step, coverScale)); 
                  }
                  setHasManuallyAdjustedZoom(true);
                }}
              >
                {currentImage && (
                  <img 
                    ref={previewRef}
                    src={currentImage.src} 
                    alt="Preview" 
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {showControls && (
          <div className="right-panel">
            {isBatchMode && (
              <div className="batch-indicator">
                <div className="batch-text">
                  <span className="batch-count">Image {croppedResults.length + 1}</span>
                  <span className="batch-total">of {croppedResults.length + batchQueue.length + 1}</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${((croppedResults.length) / (croppedResults.length + batchQueue.length + 1)) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="controls">
              <div className="control-section">
                <div className="section-header">
                  <div className="section-icon">📐</div>
                  <div className="section-title">Dimensions</div>
                </div>
                
                <div className="control-group">
                  <div className="control-label">Export Size</div>
                  <div className="dimension-inputs">
                    <div className="input-wrapper">
                      <input 
                        type="number" 
                        className="dimension-input"
                        placeholder="Width"
                        value={exportWidth}
                        onChange={(e) => handleExportWidthChange(e.target.value)}
                      />
                      <span className="input-label">W</span>
                    </div>
                    <div className="dimension-separator">×</div>
                    <div className="input-wrapper">
                      <input 
                        type="number" 
                        className="dimension-input"
                        placeholder="Height"
                        value={exportHeight}
                        onChange={(e) => handleExportHeightChange(e.target.value)}
                      />
                      <span className="input-label">H</span>
                    </div>
                  </div>
                </div>

                <div className="control-group">
                  <div className="control-label">Aspect Ratio</div>
                  <div className="slider-container">
                    <SliderWithDots
                      min={0.3333}
                      max={3}
                      step={0.01}
                      value={aspectRatio}
                      onChange={(e) => {
                        const newRatio = parseFloat(e.target.value);
                        setAspectRatio(newRatio);
                        setCustomAspectRatio(newRatio);
                        setExportWidth(Math.round(exportHeight * newRatio));
                      }}
                      onDoubleClick={handleAspectRatioDoubleClick}
                    />
                    <div className={`value-display ${isCustomAspectRatio(aspectRatio) ? 'custom' : ''}`}>
                      {aspectRatio >= 1 ? `${aspectRatio.toFixed(2)}:1` : `1:${(1/aspectRatio).toFixed(2)}`}
                    </div>
                  </div>
                  <div className="ratio-grid">
                    {keystoneRatios.map((ratio, index) => (
                      <button
                        key={index}
                        className={`ratio-btn ${aspectRatio === ratio.value ? 'active' : ''}`}
                        onClick={() => {
                          setAspectRatio(ratio.value);
                          setExportWidth(Math.round(exportHeight * ratio.value));
                          setCustomAspectRatio(null);
                        }}
                      >
                        {ratio.label}
                      </button>
                    ))}
                    {customAspectRatio && (
                      <button
                        className="ratio-btn custom-ratio-btn active"
                        onClick={() => {
                          setAspectRatio(customAspectRatio);
                          setExportWidth(Math.round(exportHeight * customAspectRatio));
                        }}
                      >
                        Custom
                      </button>
                    )}
                  </div>
                  <HelpText>
                    Choose preset ratios or drag slider for custom ratios that save automatically.
                  </HelpText>
                </div>
              </div>

              <div className="control-section">
                <div className="section-header">
                  <div className="section-icon">🔍</div>
                  <div className="section-title">View</div>
                </div>
                
                <div className="control-group">
                  <div className="control-label">Zoom Level</div>
                  <div className="slider-container">
                    <SliderWithDots
                      min={coverScale}
                      max={2}
                      step={0.01}
                      value={userZoom}
                      onChange={(e) => {
                        setUserZoom(parseFloat(e.target.value));
                        setHasManuallyAdjustedZoom(true);
                      }}
                      onDoubleClick={handleZoomDoubleClick}
                    />
                    <div className={`value-display zoom-display ${getZoomDisplayClass(userZoom)}`}>
                      {userZoom.toFixed(2)}×
                    </div>
                  </div>
                  <HelpText>
                    Scroll wheel over image to zoom. Orange = upscaled, Red = highly upscaled.
                  </HelpText>
                </div>
              </div>

              <div className="control-section">
                <div className="section-header">
                  <div className="section-icon">📁</div>
                  <div className="section-title">Output</div>
                </div>
                
                <div className="control-group">
                  <div className="control-label">Filename</div>
                  <div className="filename-input-wrapper">
                    <input 
                      type="text" 
                      className="filename-input"
                      placeholder="Enter filename..."
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                    />
                    <div className="filename-extension">.jpg</div>
                  </div>
                  <HelpText>
                    Custom filename for exported images. Random suffix added automatically.
                  </HelpText>
                </div>
              </div>
            </div>

            <div className="export-section">
              <div className="export-header">
                <div className="export-icon">⚡</div>
                <div className="export-title">Export</div>
              </div>
              {isBatchMode ? (
                <div className="export-actions">
                  {batchQueue.length > 0 ? (
                    <button className="export-btn primary" onClick={processBatchNext}>
                      <span className="btn-icon">→</span>
                      <span className="btn-text">Process Next</span>
                      <span className="btn-badge">{batchQueue.length} left</span>
                    </button>
                  ) : (
                    <button className="export-btn success" onClick={downloadZip}>
                      <span className="btn-icon">📦</span>
                      <span className="btn-text">Download ZIP</span>
                      <span className="btn-badge">{croppedResults.length} images</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="export-actions">
                  <button className="export-btn primary" onClick={downloadImage}>
                    <span className="btn-icon">⬇</span>
                    <span className="btn-text">Download Image</span>
                  </button>
                </div>
              )}
              <div className="export-shortcut">
                Press <kbd>Enter</kbd> to export
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

ReactDOM.render(<CropTool />, document.getElementById('root'));