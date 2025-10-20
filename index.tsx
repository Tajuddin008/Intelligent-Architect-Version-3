
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import './index.css';

type Mode = 'text-to-image' | 'image-to-interior' | 'architectural' | 'outline';
type StylePreset = 'photorealistic' | 'cartoon' | 'watercolor' | 'cyberpunk';
type FilterType = 'grayscale' | 'sepia' | 'invert';

interface InputImage {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

interface ArchitecturalPlan {
    walls: Array<{ boundary: Array<{ x: number; y: number }> }>;
    doors?: Array<{ boundary: Array<{ x: number; y: number }> }>;
    windows?: Array<{ boundary: Array<{ x: number; y: number }> }>;
    dimensions: { width: number; height: number };
}

interface OutlineData {
    paths: Array<{ boundary: Array<{ x: number; y: number }> }>;
    dimensions: { width: number; height: number };
}


const stylePresets: Record<StylePreset, string> = {
  photorealistic: ', photorealistic, 8k, highly detailed, sharp focus',
  cartoon: ', cartoon style, vibrant colors, bold outlines',
  watercolor: ', watercolor painting, soft edges, blended colors',
  cyberpunk: ', cyberpunk aesthetic, neon lighting, futuristic city, dystopian',
};

const roomTypes = ['Bedroom', 'Kitchen', 'Bathroom', 'Living Room', 'Dining Room', 'Hallway', 'Closet', 'Office', 'Garage'];

const Login = ({ onLogin }: { onLogin: (email: string) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setError('');
    onLogin(email);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">Intelligent Architect</h1>
        <p className="login-tagline">Welcome. Let's create something beautiful.</p>
        <form onSubmit={handleAuth}>
          {error && <p className="login-error">{error}</p>}
          <input
            type="email"
            placeholder="Email Address"
            aria-label="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="login-input"
          />
          <input
            type="password"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="login-input"
          />
          <button type="submit" className="login-button">Login</button>
          <button type="submit" className="login-button secondary">Sign Up</button>
        </form>
      </div>
    </div>
  );
};


const IntelligentArchitectApp = ({ userEmail, onLogout }: { userEmail: string, onLogout: () => void }) => {
  const [prompt, setPrompt] = useState('');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('text-to-image');
  const [inputImage, setInputImage] = useState<InputImage | null>(null);
  const [planData, setPlanData] = useState<ArchitecturalPlan | null>(null);
  const [outlineData, setOutlineData] = useState<OutlineData | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<StylePreset | null>(null);
  const [rooms, setRooms] = useState([{ id: 1, name: '', type: 'Bedroom' }]);
  const [isGeneratingWireframe, setIsGeneratingWireframe] = useState(false);


  // Cropping State
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number; } | null>(null);
  const [cropStartPoint, setCropStartPoint] = useState<{ x: number; y: number; } | null>(null);

  // Zoom and Pan State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPanPoint, setStartPanPoint] = useState({ x: 0, y: 0 });
  
  // Filter State
  const [activeFilter, setActiveFilter] = useState<FilterType | null>(null);
  const [showWireframe, setShowWireframe] = useState(false);
  const [imageRenderedSize, setImageRenderedSize] = useState({ width: 0, height: 0, x: 0, y: 0 });


  const fileInputRef = useRef<HTMLInputElement>(null);
  const outputImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (generatedImage && outputImageRef.current) {
        const imgElement = outputImageRef.current;
        
        const calculateSize = () => {
            if (!imgElement) return;
            const { clientWidth, clientHeight } = imgElement;
            setImageRenderedSize({ width: clientWidth, height: clientHeight, x: 0, y: 0 });
        };

        if (imgElement.complete && imgElement.naturalWidth > 0) {
            calculateSize();
        } else {
            imgElement.addEventListener('load', calculateSize);
        }

        const resizeObserver = new ResizeObserver(calculateSize);
        resizeObserver.observe(imgElement);
        
        return () => {
            imgElement.removeEventListener('load', calculateSize);
            resizeObserver.disconnect();
        };
    }
  }, [generatedImage]);


  const resetZoomAndPan = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsPanning(false);
  };

  const resetOutputs = () => {
    setOriginalImage(null);
    setGeneratedImage(null);
    setPlanData(null);
    setOutlineData(null);
    setError(null);
    setIsCropping(false);
    setCropRect(null);
    setCropStartPoint(null);
    setActiveFilter(null);
    setShowWireframe(false);
    setImageRenderedSize({ width: 0, height: 0, x: 0, y: 0 });
    resetZoomAndPan();
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    resetOutputs();
    setInputImage(null);
    setPrompt('');
    setSelectedStyle(null);
    if (newMode === 'architectural') {
        setRooms([{ id: 1, name: 'Master Bedroom', type: 'Bedroom' }]);
    }
  };
  
  const handleStyleClick = (style: StylePreset) => {
    // If the clicked style is already selected, deselect it and remove its text
    if (selectedStyle === style) {
        setPrompt(prompt.replace(stylePresets[style], ''));
        setSelectedStyle(null);
    } else {
        let newPrompt = prompt;
        // If there was a style previously selected, remove its text first
        if (selectedStyle) {
            newPrompt = newPrompt.replace(stylePresets[selectedStyle], '');
        }
        // Add the new style's text
        setPrompt(newPrompt + stylePresets[style]);
        setSelectedStyle(style);
    }
  };

  const removeInputImage = () => {
    setInputImage(null);
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Unsupported file type. Please upload a JPEG, PNG, or WebP.');
        return;
      }
      
      const reader = new FileReader();
      reader.onerror = () => {
          setError('Failed to read the image file. It may be corrupted.');
      };
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
            const base64Data = dataUrl.split(',')[1];
            if (!base64Data) {
                setError('Could not parse image data from file.');
                return;
            }

            setInputImage({
                base64: base64Data,
                mimeType: file.type,
                previewUrl: dataUrl,
            });
        } else {
             setError('Could not read the image file.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Architectural Plan Room Handlers
  const handleAddRoom = () => {
    setRooms([...rooms, { id: Date.now(), name: '', type: 'Bedroom' }]);
  };

  const handleRemoveRoom = (id: number) => {
    setRooms(rooms.filter(room => room.id !== id));
  };

  const handleRoomChange = (id: number, field: 'name' | 'type', value: string) => {
    setRooms(rooms.map(room => room.id === id ? { ...room, [field]: value } : room));
  };

  const generateDxfContent = (plan: ArchitecturalPlan): string => {
    let dxf = '999\nDXF generated by Intelligent Architect\n';

    // HEADER section
    dxf += '0\nSECTION\n2\nHEADER\n';
    dxf += '9\n$ACADVER\n1\nAC1009\n'; // AutoCAD R12
    dxf += '0\nENDSEC\n';

    // TABLES section
    dxf += '0\nSECTION\n2\nTABLES\n';
    dxf += '0\nTABLE\n2\nLAYER\n70\n4\n';

    // Layer definitions
    dxf += '0\nLAYER\n2\n0\n70\n64\n62\n7\n6\nCONTINUOUS\n'; // Name, flags, color (7=white), linetype
    dxf += '0\nLAYER\n2\nWALLS\n70\n64\n62\n1\n6\nCONTINUOUS\n'; // color 1 = Red
    dxf += '0\nLAYER\n2\nDOORS\n70\n64\n62\n2\n6\nCONTINUOUS\n'; // color 2 = Yellow
    dxf += '0\nLAYER\n2\nWINDOWS\n70\n64\n62\n4\n6\nCONTINUOUS\n'; // color 4 = Cyan

    dxf += '0\nENDTAB\n';
    dxf += '0\nENDSEC\n';

    // ENTITIES section
    dxf += '0\nSECTION\n2\nENTITIES\n';

    const createPolyline = (points: Array<{x: number; y: number}>, layer: string, isClosed: boolean = true) => {
        let entity = `0\nLWPOLYLINE\n100\nAcDbEntity\n8\n${layer}\n100\nAcDbPolyline\n`;
        entity += `90\n${points.length}\n`;
        entity += `70\n${isClosed ? 1 : 0}\n`;
        points.forEach(p => {
            // Invert Y-axis for standard CAD coordinate system (Y increases upwards)
            const invertedY = plan.dimensions.height - p.y;
            entity += `10\n${p.x}\n20\n${invertedY}\n`;
        });
        return entity;
    };

    plan.walls.forEach(wall => {
        dxf += createPolyline(wall.boundary, 'WALLS', true);
    });

    plan.doors?.forEach(door => {
        dxf += createPolyline(door.boundary, 'DOORS', false);
    });
    plan.windows?.forEach(window => {
        dxf += createPolyline(window.boundary, 'WINDOWS', false);
    });

    dxf += '0\nENDSEC\n';
    dxf += '0\nEOF\n';

    return dxf;
  }

    const generateOutlineDxfContent = (data: OutlineData): string => {
        let dxf = '999\nDXF generated by Intelligent Architect\n';
        // HEADER
        dxf += '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n';
        // TABLES (Layer definition)
        dxf += '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n2\n';
        dxf += '0\nLAYER\n2\n0\n70\n64\n62\n7\n6\nCONTINUOUS\n'; // Default Layer 0
        dxf += '0\nLAYER\n2\nOUTLINE\n70\n64\n62\n0\n6\nCONTINUOUS\n'; // OUTLINE Layer (color 0 = black)
        dxf += '0\nENDTAB\n0\nENDSEC\n';
        // ENTITIES
        dxf += '0\nSECTION\n2\nENTITIES\n';
        const createPolyline = (points: Array<{x: number; y: number}>, layer: string) => {
            let entity = `0\nLWPOLYLINE\n100\nAcDbEntity\n8\n${layer}\n100\nAcDbPolyline\n`;
            entity += `90\n${points.length}\n70\n0\n`; // Not closed
            points.forEach(p => {
                const invertedY = data.dimensions.height - p.y;
                entity += `10\n${p.x}\n20\n${invertedY}\n`;
            });
            return entity;
        };
        data.paths.forEach(path => {
            dxf += createPolyline(path.boundary, 'OUTLINE');
        });
        dxf += '0\nENDSEC\n0\nEOF\n';
        return dxf;
    };

    const generateOutlineSvgContent = (data: OutlineData): string => {
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${data.dimensions.width}" height="${data.dimensions.height}" viewBox="0 0 ${data.dimensions.width} ${data.dimensions.height}">`;
        svg += '<style>.outline-path { fill: none; stroke: black; stroke-width: 2px; }</style>';
        data.paths.forEach(path => {
            const points = path.boundary.map(p => `${p.x},${p.y}`).join(' ');
            svg += `<polyline points="${points}" class="outline-path" />`;
        });
        svg += '</svg>';
        return svg;
    };

  const handleDownload = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt || isLoading) return;

    if ((mode === 'image-to-interior' || mode === 'outline') && !inputImage) {
        setError(`Please upload an image for ${mode} mode.`);
        return;
    }
     if (mode === 'architectural' && !inputImage && rooms.some(r => !r.name)) {
        setError('Please provide a name for every room.');
        return;
    }


    setIsLoading(true);
    resetOutputs();

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let imageUrl: string | null = null;

      if (mode === 'architectural') {
        const roomDescriptions = rooms.map(r => `- ${r.name} (Type: ${r.type})`).join('\n');
        
        const renderBasePrompt = `The view must be a direct, orthographic projection from directly above, with no perspective or angle. The output should be a clean, professional, fully 2D floor plan.`;
        const renderWithFurniturePrompt = `styled like a professional architectural visualization. Include realistic textures and tasteful, appropriate furniture for the specified rooms.`;
        
        if (inputImage) {
            const renderPrompt = `Analyze the provided floor plan image (sketch, blueprint, etc.). Generate a high-quality, strictly top-down 2D floor plan render based on its layout, ${renderWithFurniturePrompt} ${renderBasePrompt}
User's description: ${prompt}
Rooms to include:\n${roomDescriptions}`;
            const imagePart = { inlineData: { mimeType: inputImage.mimeType, data: inputImage.base64 } };
            const textPart = { text: renderPrompt };
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [imagePart, textPart] },
                config: { responseModalities: [Modality.IMAGE] },
            });
            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        break;
                    }
                }
            }
        } else {
            const renderPrompt = `Generate a high-quality, strictly top-down 2D floor plan render, ${renderWithFurniturePrompt} ${renderBasePrompt}
User's specifications: ${prompt}
Rooms to include:\n${roomDescriptions}`;
            const response = await ai.models.generateImages({
              model: 'imagen-4.0-generate-001',
              prompt: renderPrompt,
              config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio: '4:3' },
            });
            if (response.generatedImages?.[0]?.image?.imageBytes) {
                imageUrl = `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
            }
        }

        if (!imageUrl) throw new Error("The model didn't return a visual image. Try a different prompt.");
        
        setOriginalImage(imageUrl);
        setGeneratedImage(imageUrl);
      } else if (mode === 'image-to-interior' && inputImage) {
        const imagePart = { inlineData: { mimeType: inputImage.mimeType, data: inputImage.base64 } };
        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [imagePart, textPart] },
          config: { responseModalities: [Modality.IMAGE] },
        });
        
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                }
            }
        }
        if (!imageUrl) setError("The model didn't return an image. Try a different prompt.");
      } else if (mode === 'outline' && inputImage) {
        const imagePart = { inlineData: { mimeType: inputImage.mimeType, data: inputImage.base64 } };
        const outlinePrompt = `Generate a clean, black and white outline drawing of the provided image. The style should be minimalist, focusing only on the primary edges and contours of the subjects and shapes. The background should be solid white. Do not include any shading, color, or texture. User's refinement: ${prompt}`;
        const textPart = { text: outlinePrompt };

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [imagePart, textPart] },
          config: { responseModalities: [Modality.IMAGE] },
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                }
            }
        }
        if (!imageUrl) setError("The model didn't return an image. Try a different prompt.");
        
        if (imageUrl) {
            const generatedImageBase64 = imageUrl.split(',')[1];
            const generatedImageMimeType = imageUrl.match(/^data:(image\/[^;]+);/)?.[1] || 'image/png';
            const imagePartForTrace = { inlineData: { mimeType: generatedImageMimeType, data: generatedImageBase64 } };
            const tracePromptText = `Analyze the provided black and white outline image. Trace all the black lines precisely. Generate a structured JSON object with vector data for all paths. The coordinate system origin (0,0) is top-left. The dimensions object should reflect the pixel dimensions of the input image.`;

            const outlineSchema = {
                type: Type.OBJECT,
                properties: {
                    paths: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { boundary: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } } } } } } },
                    dimensions: { type: Type.OBJECT, properties: { width: { type: Type.NUMBER }, height: { type: Type.NUMBER } } },
                },
            };

            const jsonResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [imagePartForTrace, { text: tracePromptText }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: outlineSchema,
                },
            });

            const jsonText = jsonResponse.text.trim();
            if (jsonText) {
                try {
                    setOutlineData(JSON.parse(jsonText));
                } catch (parseError) {
                    console.error("Failed to parse outline JSON:", jsonText, parseError);
                    throw new Error("The AI returned an invalid data structure for the outline. Please try modifying your prompt.");
                }
            }
        }

      } else { // Text-to-image mode
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '1:1',
            },
        });

        if (response.generatedImages?.[0]?.image?.imageBytes) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            imageUrl = `data:image/png;base64,${base64ImageBytes}`;
        }
        if (!imageUrl) setError("The model didn't return an image. Try a different prompt.");
      }

      if (imageUrl && mode !== 'architectural') {
        setOriginalImage(imageUrl);
        setGeneratedImage(imageUrl);
      }
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      let errorMessage = 'An unexpected error occurred. Please try again later.';
      const message = err?.message || String(err);

      if (message.includes('API key not valid') || message.includes('billed users')) {
        errorMessage = 'The AI service is currently unavailable due to a configuration issue. Our team has been notified.';
      } else if (message.includes('deadline exceeded')) {
        errorMessage = 'The request to the AI service timed out. Please check your connection and try again.';
      } else if (message.includes('resource has been exhausted')) {
        errorMessage = 'The AI service is currently experiencing high demand. Please try again in a few moments.';
      } else if (message.includes('invalid data structure') || message.includes('valid SVG')) {
        errorMessage = message;
      }
      
      setError(`Sorry, the alchemy failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateWireframe = async () => {
    if (!generatedImage || isGeneratingWireframe) return;

    setIsGeneratingWireframe(true);
    setError(null);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const originalImageMimeType = generatedImage.match(/^data:(image\/[^;]+);/)?.[1] || 'image/png';
        const originalImageBase64 = generatedImage.split(',')[1];
        
        // Step 1: Generate a clean black-and-white mask from the photorealistic image.
        const maskGenerationPrompt = `From the provided floor plan image, create an ultra-clean, high-contrast, black-and-white architectural diagram.
- CRITICAL: All structural walls MUST be rendered as solid, filled, pure black shapes (#000000).
- CRITICAL: The background MUST be pure white (#FFFFFF).
- CRITICAL: REMOVE ALL furniture, textures, shading, shadows, labels, and decorative items.
The output must be a minimalist line drawing showing only the structural layout.`;

        const maskGenerationResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [
                { inlineData: { mimeType: originalImageMimeType, data: originalImageBase64 } },
                { text: maskGenerationPrompt }
            ]},
            config: { responseModalities: [Modality.IMAGE] },
        });

        let maskImageBase64: string | null = null;
        let maskImageMimeType: string = 'image/png';

        if (maskGenerationResponse.candidates?.[0]?.content?.parts) {
            for (const part of maskGenerationResponse.candidates[0].content.parts) {
                if (part.inlineData) {
                    maskImageBase64 = part.inlineData.data;
                    maskImageMimeType = part.inlineData.mimeType;
                    break;
                }
            }
        }

        if (!maskImageBase64) {
            throw new Error("The AI failed to create a clean tracing mask for the wireframe.");
        }
        
        // Step 2: Use the clean mask to generate the vector JSON data.
        const pointSchema = { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } } };
        const boundarySchema = { type: Type.ARRAY, items: pointSchema };
        const planSchema = {
            type: Type.OBJECT,
            properties: {
                walls: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { boundary: boundarySchema } } },
                dimensions: { type: Type.OBJECT, properties: { width: { type: Type.NUMBER }, height: { type: Type.NUMBER } } }
            },
            required: ['walls', 'dimensions']
        };

        const jsonPrompt = `You are a high-precision, automated raster-to-vector conversion engine. Your performance is judged solely on pixel-perfect accuracy.

**Primary Objective:** Your single purpose is to convert a raster image of a floor plan into a structured JSON object representing the walls.

**Input:** A black-and-white raster image where structural walls are solid black filled areas.
**Output:** A single, raw JSON object. No other text, explanations, or markdown is permitted.

---
**ABSOLUTE DIRECTIVES**
---
1.  **ACCURACY IS PARAMOUNT:** The output MUST be a literal, pixel-perfect trace of the solid black areas. There is ZERO tolerance for approximation or simplification.
2.  **WALLS ARE POLYGONS:** Every wall, regardless of size, MUST be represented as a closed polygon defining its full external perimeter. The first and last coordinate pair in a \`boundary\` array MUST be identical.
3.  **COORDINATE SYSTEM:** The coordinate system is defined by the input image's pixel dimensions. The origin (0,0) is the TOP-LEFT corner.

---
**TRACING PROTOCOL (Follow these steps):**
---
1.  Identify all distinct, continuous areas of solid black pixels (#000000).
2.  For each area, trace its exact external boundary where black pixels meet non-black pixels.
3.  Record the sequence of vertex coordinates for this boundary with perfect precision.
4.  Format these vertices into a closed polygon structure for the JSON output.

---
*** CRITICAL FAILURE MODES (DO NOT DO THIS) ***
---
*   **FAILURE: ANY SIMPLIFICATION.** Any smoothing, straightening, or "beautifying" of the trace is a critical failure.
*   **FAILURE: CENTERLINE TRACING.** Representing a wall with a single line is a critical failure.
*   **FAILURE: ROOM BOXES.** Drawing a simple box around a room instead of tracing the actual wall geometry is a critical failure.
*   **FAILURE: TRACING NON-WALLS.** Tracing ANY element that is not a solid black wall (e.g., furniture, text, shadows, patterns) is a critical failure.
*   **FAILURE: OPEN POLYGONS.** Every wall polygon must be fully closed.

Execute the conversion now. Provide only the raw JSON output.`;


        const imagePart = { inlineData: { mimeType: maskImageMimeType, data: maskImageBase64 } };
        const textPart = { text: jsonPrompt };

        const jsonResponse = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: planSchema
            }
        });

        const jsonText = jsonResponse.text.trim();
        if (jsonText) {
            try {
                setPlanData(JSON.parse(jsonText));
                setShowWireframe(true);
            } catch (parseError) {
                console.error("Failed to parse architectural plan JSON:", jsonText, parseError);
                throw new Error("The AI returned an invalid data structure for the wireframe. Please try again.");
            }
        } else {
            throw new Error("The AI did not return any data for the wireframe.");
        }
    } catch (err: any) {
        console.error("Wireframe Generation Error:", err);
        setError(`Failed to generate wireframe: ${err.message || 'Unknown error'}`);
        setPlanData(null);
    } finally {
        setIsGeneratingWireframe(false);
    }
  };
  
  // Cropping Handlers
  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!outputImageRef.current) return;
    const rect = outputImageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCropStartPoint({ x, y });
    setCropRect({ x, y, width: 0, height: 0 });
  };

  const handleCropMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cropStartPoint || !outputImageRef.current) return;
    const rect = outputImageRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const startX = cropStartPoint.x;
    const startY = cropStartPoint.y;

    const newX = Math.min(startX, currentX);
    const newY = Math.min(startY, currentY);
    const newWidth = Math.abs(currentX - startX);
    const newHeight = Math.abs(currentY - startY);
    
    const constrainedX = Math.max(0, newX);
    const constrainedY = Math.max(0, newY);
    const constrainedWidth = Math.min(newWidth, rect.width - constrainedX);
    const constrainedHeight = Math.min(newHeight, rect.height - constrainedY);

    setCropRect({ x: constrainedX, y: constrainedY, width: constrainedWidth, height: constrainedHeight });
  };

  const handleCropMouseUp = () => {
    setCropStartPoint(null);
  };
  
  const handleConfirmCrop = () => {
    if (!cropRect || !outputImageRef.current || !generatedImage) return;

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = generatedImage;
    image.onload = () => {
      const naturalWidth = image.naturalWidth;
      const naturalHeight = image.naturalHeight;
      const displayedWidth = outputImageRef.current!.clientWidth;
      const displayedHeight = outputImageRef.current!.clientHeight;

      const scaleX = naturalWidth / displayedWidth;
      const scaleY = naturalHeight / displayedHeight;

      const sourceX = cropRect.x * scaleX;
      const sourceY = cropRect.y * scaleY;
      const sourceWidth = cropRect.width * scaleX;
      const sourceHeight = cropRect.height * scaleY;
      
      if (sourceWidth < 1 || sourceHeight < 1) {
          setIsCropping(false);
          setCropRect(null);
          return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(
        image,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, sourceWidth, sourceHeight
      );

      const mimeType = generatedImage.match(/^data:(image\/[^;]+);/)?.[1] || 'image/png';
      const croppedDataUrl = canvas.toDataURL(mimeType);

      setOriginalImage(croppedDataUrl);
      setGeneratedImage(croppedDataUrl);
      setActiveFilter(null);
      setIsCropping(false);
      setCropRect(null);
      resetZoomAndPan();
    };
  };

  const handleCancelCrop = () => {
      setIsCropping(false);
      setCropRect(null);
      setCropStartPoint(null);
  };

  // Pan and Zoom Handlers
    const handleZoom = (direction: 'in' | 'out') => {
        const zoomFactor = 0.2;
        const newZoom = direction === 'in' ? zoom + zoomFactor : zoom - zoomFactor;
        const clampedZoom = Math.min(Math.max(newZoom, 0.2), 5); // min 20%, max 500%
        setZoom(clampedZoom);
    };

    const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
        if (isCropping) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const zoomSpeed = -0.001;
        const delta = e.deltaY * zoomSpeed;
        
        const newZoom = Math.min(Math.max(zoom + delta, 0.2), 5);

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const newX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
        const newY = mouseY - (mouseY - pan.y) * (newZoom / zoom);
        
        setZoom(newZoom);
        setPan({ x: newX, y: newY });
    };

    const handlePanMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isCropping) return;
        e.preventDefault();
        setIsPanning(true);
        setStartPanPoint({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handlePanMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isPanning || isCropping) return;
        e.preventDefault();
        setPan({
            x: e.clientX - startPanPoint.x,
            y: e.clientY - startPanPoint.y,
        });
    };

    const handlePanMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
        if(isPanning) {
            e.preventDefault();
            setIsPanning(false);
        }
    };

    // Filter Handlers
    const applyFilter = (filter: FilterType) => {
        if (activeFilter === filter) { // Toggle off
            setActiveFilter(null);
            if(originalImage) setGeneratedImage(originalImage);
            return;
        }

        setActiveFilter(filter);

        if (!originalImage) return;

        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = originalImage;
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const filterMap: Record<FilterType, string> = {
                grayscale: 'grayscale(100%)',
                sepia: 'sepia(100%)',
                invert: 'invert(100%)',
            };

            ctx.filter = filterMap[filter];
            ctx.drawImage(image, 0, 0);

            const mimeType = originalImage.match(/^data:(image\/[^;]+);/)?.[1] || 'image/png';
            const filteredDataUrl = canvas.toDataURL(mimeType);
            setGeneratedImage(filteredDataUrl);
        };
    };

    const removeFilters = () => {
        if (originalImage) {
            setGeneratedImage(originalImage);
        }
        setActiveFilter(null);
    }

  const renderOutput = () => {
    if (isLoading) {
      return (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Conjuring pixels... Your vision is materializing.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <h3>An Error Occurred</h3>
          <p>{error}</p>
          <button onClick={() => setError(null)} className="action-button">Try Again</button>
        </div>
      );
    }

    if (generatedImage) {
      return (
        <div className="output-image-container">
            <div 
                className={`image-wrapper ${!isCropping && generatedImage ? 'pannable' : ''} ${isPanning ? 'panning' : ''}`}
                onMouseDown={handlePanMouseDown}
                onMouseMove={isPanning ? handlePanMouseMove : undefined}
                onMouseUp={isPanning ? handlePanMouseUp : undefined}
                onMouseLeave={isPanning ? handlePanMouseUp : undefined}
                onWheel={!isCropping ? handleWheelZoom : undefined}
            >
                <div 
                  className="transform-container"
                  style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  }}
                >
                    <img 
                        ref={outputImageRef}
                        src={generatedImage} 
                        alt={prompt} 
                        className="generated-image" 
                        onDragStart={(e) => e.preventDefault()}
                    />
                    {showWireframe && planData && planData.dimensions && (
                        <div 
                            className="wireframe-overlay"
                            style={{
                                width: `${imageRenderedSize.width}px`,
                                height: `${imageRenderedSize.height}px`,
                            }}
                        >
                            <svg width="100%" height="100%" viewBox={`0 0 ${planData.dimensions.width} ${planData.dimensions.height}`} preserveAspectRatio="none">
                                {planData.walls.map((wall, i) => (
                                <polygon key={`wall-${i}`} points={wall.boundary.map(p => `${p.x},${p.y}`).join(' ')} className="wall-shape" vectorEffect="non-scaling-stroke" />
                                ))}
                                {planData.windows?.map((window, i) => (
                                    <polyline key={`window-${i}`} points={window.boundary.map(p => `${p.x},${p.y}`).join(' ')} className="window-shape" vectorEffect="non-scaling-stroke" />
                                ))}
                                {planData.doors?.map((door, i) => (
                                    <polyline key={`door-${i}`} points={door.boundary.map(p => `${p.x},${p.y}`).join(' ')} className="door-shape" vectorEffect="non-scaling-stroke" />
                                ))}
                            </svg>
                        </div>
                    )}
                </div>

                {isCropping && (
                    <div 
                        className="crop-overlay"
                        onMouseDown={handleCropMouseDown}
                        onMouseMove={handleCropMouseMove}
                        onMouseUp={handleCropMouseUp}
                        onMouseLeave={handleCropMouseUp}
                    >
                        {cropRect && (
                            <div 
                                className="crop-selection"
                                style={{
                                    left: `${cropRect.x}px`,
                                    top: `${cropRect.y}px`,
                                    width: `${cropRect.width}px`,
                                    height: `${cropRect.height}px`,
                                }}
                            />
                        )}
                    </div>
                )}
                {generatedImage && !isCropping && (
                    <div className="zoom-controls">
                        <button onClick={() => handleZoom('out')} aria-label="Zoom out">-</button>
                        <button onClick={resetZoomAndPan} aria-label="Reset zoom">Reset</button>
                        <button onClick={() => handleZoom('in')} aria-label="Zoom in">+</button>
                    </div>
                )}
            </div>
            {generatedImage && !isCropping && (
                <div className="filter-controls">
                    <button className={`filter-button ${activeFilter === 'grayscale' ? 'active' : ''}`} onClick={() => applyFilter('grayscale')}>Grayscale</button>
                    <button className={`filter-button ${activeFilter === 'sepia' ? 'active' : ''}`} onClick={() => applyFilter('sepia')}>Sepia</button>
                    <button className={`filter-button ${activeFilter === 'invert' ? 'active' : ''}`} onClick={() => applyFilter('invert')}>Invert</button>
                    {mode === 'architectural' && generatedImage && (
                        <button 
                            className={`filter-button ${showWireframe ? 'active' : ''}`} 
                            onClick={() => {
                                if (planData) {
                                    setShowWireframe(prev => !prev);
                                } else {
                                    handleGenerateWireframe();
                                }
                            }}
                            disabled={isGeneratingWireframe}
                        >
                            {isGeneratingWireframe ? 'Tracing...' : (planData ? 'Wireframe' : 'Generate Wireframe')}
                        </button>
                    )}
                    <button className="filter-button reset-filter" onClick={removeFilters} disabled={!activeFilter}>Reset</button>
                </div>
            )}
            <div className="output-actions">
                {isCropping ? (
                    <>
                        <button onClick={handleConfirmCrop} className="action-button confirm-button" disabled={!cropRect || cropRect.width < 1 || cropRect.height < 1}>
                           Confirm Crop
                        </button>
                        <button onClick={handleCancelCrop} className="action-button cancel-button">
                           Cancel
                        </button>
                    </>
                ) : (
                    <button onClick={() => {setIsCropping(true); resetZoomAndPan();}} className="action-button">
                        Crop Image
                    </button>
                )}
                {showWireframe && planData && (
                    <>
                        <button onClick={() => handleDownload('floorplan.svg', document.querySelector('.wireframe-overlay')!.innerHTML, 'image/svg+xml')} className="action-button">Download SVG</button>
                        <button onClick={() => handleDownload('floorplan.dxf', generateDxfContent(planData), 'application/dxf')} className="action-button">Download DXF</button>
                    </>
                )}
                {mode === 'outline' && outlineData && (
                     <>
                        <button onClick={() => handleDownload('outline.svg', generateOutlineSvgContent(outlineData), 'image/svg+xml')} className="action-button">Download SVG</button>
                        <button onClick={() => handleDownload('outline.dxf', generateOutlineDxfContent(outlineData), 'application/dxf')} className="action-button">Download DXF</button>
                    </>
                )}
            </div>
        </div>
      );
    }

    return (
      <div className="image-placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path><path d="m9.5 7.5 1 1"></path><path d="m14.5 7.5 1 1"></path><path d="M10 14a6 6 0 0 0 4 0"></path></svg>
        <p>Your generated content will appear here</p>
      </div>
    );
  };
  
  const renderImageUploader = () => (
    <div className="image-uploader">
      <label htmlFor="image-upload">Source Image</label>
        {inputImage ? (
            <div className="image-preview-container">
                <img src={inputImage.previewUrl} alt="Input preview" className="image-preview" />
                <button onClick={removeInputImage} className="remove-image-button" aria-label="Remove image">&times;</button>
            </div>
        ) : (
            <button type="button" className="upload-placeholder" onClick={() => fileInputRef.current?.click()}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>
                    {
                        mode === 'architectural' ? "Upload a sketch, plan, or point cloud slice" :
                        mode === 'outline' ? "Upload an image to create an outline from" :
                        "Upload an image of a room to redesign"
                    }
                </span>
            </button>
        )}
      <input type="file" id="image-upload" ref={fileInputRef} onChange={handleImageUpload} accept="image/png, image/jpeg, image/webp" style={{ display: 'none' }} />
    </div>
  );

  const renderArchitecturalInputs = () => (
    <div className="room-inputs-container">
        <label>Define Rooms</label>
        {rooms.map((room, index) => (
            <div key={room.id} className="room-input-row">
                <input
                    type="text"
                    aria-label={`Room ${index + 1} name`}
                    className="room-input"
                    placeholder={`e.g., Living Room ${index + 1}`}
                    value={room.name}
                    onChange={(e) => handleRoomChange(room.id, 'name', e.target.value)}
                />
                <select 
                    className="room-select" 
                    aria-label={`Room ${index + 1} type`}
                    value={room.type} 
                    onChange={(e) => handleRoomChange(room.id, 'type', e.target.value)}>
                    {roomTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
                <button type="button" className="remove-room-button" onClick={() => handleRemoveRoom(room.id)} aria-label={`Remove room ${index + 1}`}>&times;</button>
            </div>
        ))}
        <button type="button" className="add-room-button" onClick={handleAddRoom}>+ Add Room</button>
    </div>
  );

  return (
    <main className="app-container">
      <section className="input-section">
        <header>
          <div className="app-header">
            <h1>Intelligent Architect</h1>
            <div className="user-info">
              <span className="user-email" title={userEmail}>{userEmail}</span>
              <button onClick={onLogout} className="logout-button" aria-label="Logout">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              </button>
            </div>
          </div>
          <p>
            Turn your imagination into stunning architectural and interior designs. Describe what you want
            to see, and let AI bring it to life.
          </p>
        </header>
        <form className="prompt-form" onSubmit={handleGenerate}>
            <div className="mode-switcher">
                <button type="button" className={mode === 'text-to-image' ? 'active' : ''} onClick={() => handleModeChange('text-to-image')}>Text to Image</button>
                <button type="button" className={mode === 'image-to-interior' ? 'active' : ''} onClick={() => handleModeChange('image-to-interior')}>Image to Interior</button>
                <button type="button" className={mode === 'outline' ? 'active' : ''} onClick={() => handleModeChange('outline')}>Outline</button>
                <button type="button" className={mode === 'architectural' ? 'active' : ''} onClick={() => handleModeChange('architectural')}>Architectural Plan</button>
            </div>
            
            {(mode === 'image-to-interior' || mode === 'architectural' || mode === 'outline') && renderImageUploader()}

            <label htmlFor="prompt-input">Your Prompt</label>
            <textarea
              id="prompt-input"
              placeholder={
                mode === 'text-to-image' ? "e.g., A majestic lion wearing a crown, cinematic lighting" : 
                mode === 'image-to-interior' ? "e.g., Change the sofa to a blue velvet one, modern style" :
                mode === 'outline' ? "e.g., Use thicker lines for the main subject" :
                "e.g., A modern 2-bedroom apartment with an open kitchen, rendered in a photorealistic style"
              }
              rows={mode === 'architectural' ? 2 : 4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading}
            ></textarea>
            
            {mode === 'architectural' && renderArchitecturalInputs()}

            {(mode === 'text-to-image' || mode === 'image-to-interior') && (
              <div className="style-presets">
                {(Object.keys(stylePresets) as Array<StylePreset>).map((style) => (
                  <button
                    key={style}
                    type="button"
                    className={`style-button ${selectedStyle === style ? 'active' : ''}`}
                    onClick={() => handleStyleClick(style)}
                  >
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </button>
                ))}
              </div>
            )}
            
            <button
              type="submit"
              className="generate-button"
              disabled={isLoading || !prompt || ((mode === 'image-to-interior' || mode === 'outline') && !inputImage) || (mode === 'architectural' && !inputImage && rooms.some(r => !r.name))}
            >
              {isLoading ? 'Generating...' : 'Generate'}
            </button>
          </form>
      </section>
      <section className="output-section">{renderOutput()}</section>
    </main>
  );
};

const App = () => {
    const [user, setUser] = useState<{ email: string } | null>(() => {
        try {
            const savedUser = localStorage.getItem('intelligent-architect-user');
            return savedUser ? JSON.parse(savedUser) : null;
        } catch (error) {
            console.error("Failed to parse user from localStorage", error);
            return null;
        }
    });

    useEffect(() => {
        if (user) {
            localStorage.setItem('intelligent-architect-user', JSON.stringify(user));
        } else {
            localStorage.removeItem('intelligent-architect-user');
        }
    }, [user]);

    const handleLogin = (email: string) => {
        setUser({ email });
    };

    const handleLogout = () => {
        setUser(null);
    };
    
    if (!user) {
        return <Login onLogin={handleLogin} />;
    }

    return <IntelligentArchitectApp userEmail={user.email} onLogout={handleLogout} />;
}


const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
