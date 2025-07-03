const keystoneRatios = [
  { label: "1:3", value: 0.3333 },
  { label: "1:2", value: 0.5 },
  { label: "9:16", value: 0.5625 },
  { label: "10:16", value: 0.625 },
  { label: "2:3", value: 0.6667 },
  { label: "3:4", value: 0.75 },
  { label: "4:5", value: 0.8 },
  { label: "1:1", value: 1 },
  { label: "5:4", value: 1.25 },
  { label: "4:3", value: 1.3333 },
  { label: "3:2", value: 1.5 },
  { label: "16:10", value: 1.6 },
  { label: "16:9", value: 1.7778 },
  { label: "968:600", value: 968/600 },
  { label: "2:1", value: 2 },
  { label: "3:1", value: 3 }
];

const getZoomDisplayClass = (zoom) => {
  if (zoom >= 1.3) return 'zoom-red';
  if (zoom >= 1.01) return 'zoom-orange';
  return '';
};

const isCustomAspectRatio = (aspectRatio) => {
  return !keystoneRatios.some(ratio => Math.abs(ratio.value - aspectRatio) < 0.001);
};

const preventDefaults = (e) => {
  e.preventDefault();
  e.stopPropagation();
};

const downloadCanvas = (canvas, filename, fileType) => {
  const mimeType = fileType === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const extension = mimeType.split('/')[1];
  const link = document.createElement('a');
  link.download = `${filename}.${extension}`;
  link.href = canvas.toDataURL(mimeType, 0.9);
  link.click();
};

const createCroppedCanvas = (image, config) => {
  const { 
    exportWidth, 
    exportHeight, 
    displayTargetWidth, 
    displayTargetHeight, 
    offsetX, 
    offsetY, 
    currentRotation, 
    userZoom, 
    hasManuallyAdjustedZoom, 
    coverScale 
  } = config;

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
  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  ctx.restore();
  
  return canvas;
};

