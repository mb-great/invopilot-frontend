// SVG to Data URI conversion
// Note: In InvoPilot, PDFs are generated server-side by the backend worker.
// This utility is kept for potential future client-side preview use.

export const svgToDataUri = async (svgString: string): Promise<string | null> => {
  try {
    // Create a data URI directly from SVG string
    const encoded = encodeURIComponent(svgString);
    return `data:image/svg+xml,${encoded}`;
  } catch (error) {
    console.error("Error converting SVG to data URI:", error);
    return null;
  }
};
