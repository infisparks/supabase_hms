"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RefreshCw, Save, Eraser } from "lucide-react";

interface WritingPadProps {
  ipdId: string;
}

const WritingPad = ({ ipdId }: WritingPadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState("#000000"); // Default to black
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  // Function to draw notebook lines
  const drawNotebookLines = (ctx: CanvasRenderingContext2D) => {
    const canvas = ctx.canvas;
    const lineHeight = 20; // Adjust line spacing as needed
    const startY = 30; // Starting position for the lines
    const lineCount = Math.floor((canvas.height - startY) / lineHeight);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#a0a0a0"; // Line color
    ctx.lineWidth = 1;

    for (let i = 0; i < lineCount; i++) {
      const y = startY + i * lineHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  };

  // --- Initialize Canvas and Load Data ---
  const initializeCanvas = useCallback(async () => {
    setIsLoading(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    contextRef.current = context;

    // Set canvas dimensions
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.offsetWidth;
      canvas.height = 800; // Fixed height for a good writing area
    }
    
    // Draw initial lines
    drawNotebookLines(context);

    // Load previous drawing from Supabase
    try {
      const { data, error } = await supabase
        .from('ipd_record')
        .select('writing_pad_data')
        .eq('ipd_id', ipdId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.writing_pad_data) {
        const img = new Image();
        img.onload = () => {
          context.drawImage(img, 0, 0);
        };
        img.src = data.writing_pad_data;
        toast.success("Previous notes loaded.");
      }
    } catch (error) {
      console.error("Failed to load writing pad data:", error);
      toast.error("Failed to load previous notes.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    initializeCanvas();
    const handleResize = () => initializeCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initializeCanvas]);

  // --- Drawing Logic ---
  const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    if (!contextRef.current) return;
    let offsetX: number, offsetY: number;

    if ("touches" in event.nativeEvent) {
      // Touch event
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const touch = event.nativeEvent.touches[0];
      offsetX = touch.clientX - rect.left;
      offsetY = touch.clientY - rect.top;
    } else {
      // Mouse event
      offsetX = (event.nativeEvent as MouseEvent).offsetX;
      offsetY = (event.nativeEvent as MouseEvent).offsetY;
    }

    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = ({ nativeEvent }: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !contextRef.current) return;
    let offsetX: number, offsetY: number;

    if ("touches" in nativeEvent) {
      // Touch event
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const touch = nativeEvent.touches[0];
      offsetX = touch.clientX - rect.left;
      offsetY = touch.clientY - rect.top;
    } else {
      // Mouse event
      offsetX = (nativeEvent as MouseEvent).offsetX;
      offsetY = (nativeEvent as MouseEvent).offsetY;
    }

    contextRef.current.strokeStyle = penColor;
    contextRef.current.lineWidth = 2; // Line thickness
    contextRef.current.lineCap = "round";
    contextRef.current.lineTo(offsetX, offsetY);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    if (!contextRef.current) return;
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const handleClear = () => {
    if (!contextRef.current) return;
    drawNotebookLines(contextRef.current);
  };

  // --- Save Function ---
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        toast.error("Canvas not found.");
        return;
      }
      const dataUrl = canvas.toDataURL("image/png");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("User not authenticated.");
        setIsSaving(false);
        return;
      }

      const { error } = await supabase.from('ipd_record').upsert({
        ipd_id: ipdId,
        user_id: session.user.id,
        writing_pad_data: dataUrl,
      }, { onConflict: 'ipd_id,user_id' });

      if (error) throw error;
      toast.success("Notes saved successfully!");
    } catch (error) {
      console.error("Failed to save writing pad data:", error);
      toast.error("Failed to save notes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl max-w-7xl mx-auto font-sans">
      <div className="text-center mb-6">
        <h1 className="font-bold text-2xl uppercase">Digital Writing Pad</h1>
        <p className="text-gray-500">Use your S Pen or finger to write notes.</p>
      </div>

      <div className="flex justify-center items-center gap-4 mb-4 flex-wrap">
        <label htmlFor="pen-color" className="font-medium text-gray-700">Pen Color:</label>
        <input
          id="pen-color"
          type="color"
          value={penColor}
          onChange={(e) => setPenColor(e.target.value)}
          className="h-10 w-10 border-2 rounded-full cursor-pointer"
        />
      </div>

      <div className="border border-gray-400 rounded-md overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
            <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
            <p className="ml-4 text-xl text-gray-600">Loading notes...</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={draw}
          onTouchStart={startDrawing}
          onTouchEnd={stopDrawing}
          onTouchMove={draw}
          className="w-full h-auto bg-gray-50 cursor-crosshair"
        />
      </div>

      <div className="flex justify-end mt-6 space-x-4">
        <button
          onClick={handleClear}
          className="flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold bg-gray-500 hover:bg-gray-600"
        >
          <Eraser className="h-4 w-4" /> Clear Page
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold ${isSaving ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}
        >
          {isSaving ? (<> <RefreshCw className="h-4 w-4 animate-spin" /> Saving... </>) : (<><Save className="h-4 w-4" /> Save Notes</>)}
        </button>
      </div>
    </div>
  );
};

export default WritingPad;