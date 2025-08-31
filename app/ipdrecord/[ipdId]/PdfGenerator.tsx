"use client";

import React, { useCallback, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";

interface PdfGeneratorProps {
  contentRef: React.RefObject<HTMLDivElement>;
  fileName: string;
}

const PdfGenerator: React.FC<PdfGeneratorProps> = ({ contentRef, fileName }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const downloadPdf = useCallback(async () => {
    if (!contentRef.current) {
      toast.error("Form content not found. Please try again.");
      return;
    }

    setIsGenerating(true);
    toast.info("Generating PDF... Please wait.");

    const originalElement = contentRef.current;
    const clonedElement = originalElement.cloneNode(true) as HTMLElement;
    clonedElement.style.position = "absolute";
    clonedElement.style.top = "-9999px";
    clonedElement.style.left = "-9999px";
    clonedElement.style.width = originalElement.scrollWidth + "px";
    document.body.appendChild(clonedElement);

    clonedElement.querySelectorAll("button, .no-pdf").forEach((el) => {
      el.remove();
    });

    // Replace inputs, textareas, checkboxes, radios, and selects with their values
    const inputs = clonedElement.querySelectorAll("input, textarea, select");
    inputs.forEach((input) => {
      let textElement = document.createElement("span");

      if (input instanceof HTMLTextAreaElement) {
        textElement.innerHTML = input.value.replace(/\n/g, "<br/>");
      } else if (input instanceof HTMLInputElement) {
        if (input.type === "checkbox") {
          textElement.textContent = input.checked ? "☑" : "☐";
        } else if (input.type === "radio") {
          textElement.textContent = input.checked ? "◉" : "○";
        } else {
          textElement.textContent = input.value;
        }
      } else if (input instanceof HTMLSelectElement) {
        textElement.textContent =
          input.options[input.selectedIndex]?.text || "";
      }

      const computedStyle = window.getComputedStyle(input);
      for (const prop of computedStyle) {
        textElement.style.setProperty(
          prop,
          computedStyle.getPropertyValue(prop)
        );
      }

      textElement.style.backgroundColor = "#ffffff";
      textElement.style.borderBottom = "1px solid #000000";
      textElement.style.padding = "1px";

      input.parentNode?.replaceChild(textElement, input);
    });

    try {
      const canvas = await html2canvas(clonedElement, {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: clonedElement.scrollWidth,
        windowHeight: clonedElement.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/jpeg", 1.0);

      // Canvas dimensions in px
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      // Convert px → mm (at 96 DPI, 1px ≈ 0.264583 mm)
      const pxToMm = (px: number) => px * 0.264583;
      const pdfWidth = pxToMm(canvasWidth);
      const pdfHeight = pxToMm(canvasHeight);

      // Landscape if wider than tall
      const orientation = pdfWidth > pdfHeight ? "l" : "p";

      const pdf = new jsPDF(orientation, "mm", [pdfWidth, pdfHeight]);
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);

      pdf.save(`${fileName}.pdf`);
      toast.success("PDF generated and downloaded successfully!");
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      document.body.removeChild(clonedElement);
      setIsGenerating(false);
    }
  }, [contentRef, fileName]);

  return (
    <button
      onClick={downloadPdf}
      disabled={isGenerating}
      className={`no-pdf flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-colors duration-200 ${
        isGenerating
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-red-500 hover:bg-red-600"
      }`}
    >
      {isGenerating ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" /> Generating...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" /> Download PDF
        </>
      )}
    </button>
  );
};

export default PdfGenerator;
