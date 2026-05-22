import { useRef, useState, useCallback, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import type { DrawTool, DrawEventData, ServerToClientEvents, ClientToServerEvents } from '../types';
import { BRUSH_COLORS } from '../utils/constants';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseCanvasOptions {
  isDrawer: boolean;
  socket: TypedSocket | null;
  roomId: string | null;
}

interface UseCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  currentColor: string;
  brushSize: number;
  currentTool: DrawTool;
  setColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  setTool: (tool: DrawTool) => void;
  undo: () => void;
  clearCanvas: () => void;
  cursorPos: { x: number; y: number } | null;
}

export function useCanvas({ isDrawer, socket, roomId }: UseCanvasOptions): UseCanvasReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentColor, setCurrentColor] = useState(BRUSH_COLORS[0]);
  const [brushSize, setBrushSize] = useState(8);
  const [currentTool, setCurrentTool] = useState<DrawTool>('brush');
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  
  // Track all strokes for redraws
  const allStrokesRef = useRef<DrawEventData[]>([]);
  // Track the number of line segments in each continuous drag for undo
  const batchSizesRef = useRef<number[]>([]);
  const currentBatchSizeRef = useRef<number>(0);

  // Get normalized coordinates (0-1 range)
  const getNormalizedPos = useCallback((canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }, []);

  // Draw a line segment on the canvas
  const drawLine = useCallback((
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: string,
    size: number,
    tool: DrawTool
  ) => {
    const canvas = ctx.canvas;
    const actualStartX = startX * canvas.width;
    const actualStartY = startY * canvas.height;
    const actualEndX = endX * canvas.width;
    const actualEndY = endY * canvas.height;

    ctx.beginPath();
    ctx.moveTo(actualStartX, actualStartY);
    ctx.lineTo(actualEndX, actualEndY);

    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }, []);

  // Redraw all strokes (for undo / replay)
  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const stroke of allStrokesRef.current) {
      drawLine(ctx, stroke.startX, stroke.startY, stroke.endX, stroke.endY, stroke.color, stroke.size, stroke.tool);
    }
  }, [drawLine]);

  // Handle drawing start
  const handleStart = useCallback((x: number, y: number) => {
    if (!isDrawer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getNormalizedPos(canvas, x, y);

    isDrawingRef.current = true;
    lastPosRef.current = pos;
    currentBatchSizeRef.current = 0;
  }, [isDrawer, getNormalizedPos]);

  // Handle drawing move
  const handleMove = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pos = getNormalizedPos(canvas, x, y);

    // Update cursor position
    if (isDrawer) {
      const rect = canvas.getBoundingClientRect();
      setCursorPos({ x: x - rect.left, y: y - rect.top });
    }

    if (!isDrawingRef.current || !lastPosRef.current || !isDrawer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const strokeData: DrawEventData = {
      startX: lastPosRef.current.x,
      startY: lastPosRef.current.y,
      endX: pos.x,
      endY: pos.y,
      color: currentColor,
      size: brushSize,
      tool: currentTool,
    };

    // Draw locally immediately
    drawLine(ctx, strokeData.startX, strokeData.startY, strokeData.endX, strokeData.endY, strokeData.color, strokeData.size, strokeData.tool);

    // Store in history
    allStrokesRef.current.push(strokeData);
    currentBatchSizeRef.current += 1;

    // Emit to server
    if (socket && roomId) {
      socket.emit('draw', { roomId, ...strokeData });
    }

    lastPosRef.current = pos;
  }, [isDrawer, currentColor, brushSize, currentTool, socket, roomId, getNormalizedPos, drawLine]);

  // Handle drawing end
  const handleEnd = useCallback(() => {
    if (isDrawingRef.current && currentBatchSizeRef.current > 0) {
      batchSizesRef.current.push(currentBatchSizeRef.current);
      currentBatchSizeRef.current = 0;
    }
    isDrawingRef.current = false;
    lastPosRef.current = null;
  }, []);

  // Mouse events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      handleStart(e.clientX, e.clientY);
    };
    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };
    const onMouseUp = () => handleEnd();
    const onMouseLeave = () => {
      handleEnd();
      setCursorPos(null);
    };

    // Touch events
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      handleEnd();
    };

    if (isDrawer) {
      canvas.addEventListener('mousedown', onMouseDown);
      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('mouseup', onMouseUp);
      canvas.addEventListener('mouseleave', onMouseLeave);
      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    }

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDrawer, handleStart, handleMove, handleEnd]);

  // Listen for draw_data from other players
  useEffect(() => {
    if (!socket) return;

    const handleDrawData = (payload: any) => {
      const data = payload.stroke ? payload.stroke : payload;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      drawLine(ctx, data.startX, data.startY, data.endX, data.endY, data.color, data.size, data.tool);
      allStrokesRef.current.push(data);
    };

    const handleCanvasCleared = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      allStrokesRef.current = [];
      batchSizesRef.current = [];
    };

    const handleCanvasState = (data: { strokes: DrawEventData[] }) => {
      allStrokesRef.current = data.strokes || [];
      redrawAll();
    };

    socket.on('draw_data', handleDrawData);
    socket.on('canvas_cleared', handleCanvasCleared);
    socket.on('canvas_state', handleCanvasState);
    socket.on('round_start', handleCanvasCleared);
    socket.on('game_started', handleCanvasCleared);

    return () => {
      socket.off('draw_data', handleDrawData);
      socket.off('canvas_cleared', handleCanvasCleared);
      socket.off('canvas_state', handleCanvasState);
      socket.off('round_start', handleCanvasCleared);
      socket.off('game_started', handleCanvasCleared);
    };
  }, [socket, drawLine, redrawAll]);

  // Initialize canvas with white background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas internal resolution
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Undo
  const undo = useCallback(() => {
    if (!isDrawer || !socket || !roomId) return;
    // Remove the last batch of strokes (from last mousedown to mouseup)
    const lastBatchSize = batchSizesRef.current.pop();
    if (lastBatchSize && lastBatchSize > 0) {
      allStrokesRef.current.splice(-lastBatchSize);
      redrawAll();
      socket.emit('draw_undo', { roomId, count: lastBatchSize });
    }
  }, [isDrawer, socket, roomId, redrawAll]);

  // Listen for draw_undo from server (for viewers)
  useEffect(() => {
    if (!socket || isDrawer) return;

    const handleDrawUndo = (data: { count: number }) => {
      if (allStrokesRef.current.length > 0) {
        allStrokesRef.current.splice(-data.count);
        redrawAll();
      }
    };

    socket.on('draw_undo', handleDrawUndo);

    return () => {
      socket.off('draw_undo', handleDrawUndo);
    };
  }, [socket, isDrawer, redrawAll]);

  // Clear canvas
  const clearCanvasFn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    allStrokesRef.current = [];
    batchSizesRef.current = [];

    if (isDrawer && socket && roomId) {
      socket.emit('clear_canvas', { roomId });
    }
  }, [isDrawer, socket, roomId]);

  return {
    canvasRef,
    currentColor,
    brushSize,
    currentTool,
    setColor: setCurrentColor,
    setBrushSize,
    setTool: setCurrentTool,
    undo,
    clearCanvas: clearCanvasFn,
    cursorPos,
  };
}
