/* ========================================
   Gemini Vision Service - Travel Document Reader
   Reads PDFs and images, extracts travel booking data
   ======================================== */

const GeminiService = {

    API_KEY: (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.GEMINI_API_KEY) || '',
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',

    EXTRACTION_PROMPT: `You are a travel document parser. Analyze this travel booking document (ticket, hotel confirmation, car rental bill, bus pass, etc.) and extract the relevant booking details.

Return ONLY a valid JSON object with the following fields (skip fields that are not clearly present in the document):

{
  "category": "Hotel|Train|Flight|Bus|Rental Car|Activity|Other",
  "title": "Full merchant/hotel/airline name and brief description (e.g. 'IndiGo Flight 6E-123 Bangalore to Mumbai')",
  "checkIn": "YYYY-MM-DD (departure/check-in/pickup date)",
  "checkOut": "YYYY-MM-DD (arrival/check-out/drop-off date, if different from checkIn)",
  "checkInTime": "HH:MM (24hr format)",
  "checkOutTime": "HH:MM (24hr format)",
  "totalAmount": <number in INR, convert if foreign currency>,
  "advancePaid": <number: advance/partial payment already made, 0 if not shown>,
  "bookingRef": "PNR, booking ID, reservation number, or confirmation number",
  "notes": "Any extra useful info: seat number, room type, passenger names, class of travel, car model, etc."
}

Rules:
- Dates must be in YYYY-MM-DD format
- Amounts must be numbers only (no currency symbols or commas)
- If only one date is present (same-day ticket), set checkIn = checkOut
- For trains/flights: checkIn = departure date, checkOut = arrival date
- For hotels: checkIn = check-in date, checkOut = check-out date
- Return ONLY the JSON object, no markdown, no explanation, no code fences`,

    TRIP_EXTRACTION_PROMPT: `You are a travel document parser helping create a trip plan. Analyze this document and extract trip-planning details.

Return ONLY a valid JSON object with these fields (omit fields that are not present in the document):

{
  "tripName": "Short location-based trip name — DO NOT use the property/hotel/company name. Use format like 'Ooty Trip', 'Bangalore to Goa', 'Kodaikanal Weekend'. Derive from the destination city.",
  "destination": "City and State (e.g. 'Ooty, Tamil Nadu', 'Goa', 'Manali, Himachal Pradesh')",
  "startDate": "YYYY-MM-DD (earliest departure / check-in / pickup date)",
  "endDate": "YYYY-MM-DD (latest return / check-out / drop-off date)",
  "budget": <total amount as number in INR, 0 if not shown>,
  "transportMode": "flight|train|bus|car|mixed — the primary mode of transport in this document",
  "isSelfDriveTrip": <true if this is a self-drive car rental bill, petrol bill, car booking confirmation — false otherwise>,
  "isRentalVehicle": <true if a rental/hired car is involved — false otherwise>,
  "vehicleName": "Car model if clearly mentioned (e.g. 'Swift Dzire', 'Innova Crysta') — only for self-drive/rental",
  "rentalCompany": "Rental company name if present (e.g. 'Zoomcar', 'Myles', 'Revv')",
  "rentalPickupDate": "YYYY-MM-DD — rental car pickup date",
  "rentalReturnDate": "YYYY-MM-DD — rental car return/drop-off date",
  "rentalPickupLocation": "Pickup location/address from rental document",
  "rentalReturnLocation": "Return/drop-off location from rental document",
  "category": "Hotel|Train|Flight|Bus|Rental Car|Activity|Other — type of booking",
  "checkIn":  "YYYY-MM-DD — service start date (check-in, departure, pickup)",
  "checkOut": "YYYY-MM-DD — service end date (check-out, arrival, return)",
  "advancePaid": <amount already paid as advance — number in INR, 0 if not shown>,
  "bookingRef": "PNR, booking ID, or confirmation number if present"
}

Critical rules:
- tripName MUST be location-based, never use property/hotel/company name
- isSelfDriveTrip = true for: car rental confirmations, self-drive contracts, fuel/petrol bills, vehicle hire docs
- Dates must be YYYY-MM-DD format
- Return ONLY the JSON object, no markdown, no explanation`,

    /**
     * Analyze documents for TRIP creation — extracts trip-level info
     */
    async analyzeTripDocument(files) {
        if (!files) throw new Error('No file provided');
        const fileList = Array.isArray(files) ? files : [files];
        const base64Images = [];
        for (const file of fileList) {
            if (file.type === 'application/pdf') {
                const pages = await this._pdfToBase64Pages(file);
                base64Images.push(...pages);
            } else if (file.type.startsWith('image/')) {
                base64Images.push(await this._fileToBase64(file));
            }
        }
        if (base64Images.length === 0) throw new Error('Could not extract images from files.');
        return await this._callGemini(base64Images, this.TRIP_EXTRACTION_PROMPT);
    },

    /**
     * Analyze one or more files (images or PDFs) and extract travel booking data
     * @param {File|File[]} files - single file or array of files
     */
    async analyzeDocument(files) {
        if (!files) throw new Error('No file provided');

        // Normalize to array
        const fileList = Array.isArray(files) ? files : [files];
        if (fileList.length === 0) throw new Error('No files provided');

        const base64Images = [];

        for (const file of fileList) {
            const mimeType = file.type;
            if (mimeType === 'application/pdf') {
                // Convert ALL PDF pages to images
                const pages = await this._pdfToBase64Pages(file);
                base64Images.push(...pages);
            } else if (mimeType.startsWith('image/')) {
                const b64 = await this._fileToBase64(file);
                base64Images.push(b64);
            } else {
                throw new Error(`Unsupported file type: ${file.name}. Please upload PDF, JPG, or PNG.`);
            }
        }

        if (base64Images.length === 0) throw new Error('Could not extract any images from the files.');

        // Call Gemini with all images in one request
        return await this._callGemini(base64Images);
    },

    /**
     * Convert ALL pages of a PDF to base64 JPEG images via PDF.js
     */
    async _pdfToBase64Pages(file) {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js is not loaded. Please refresh the app.');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdfDoc.numPages;
        const pages = [];

        // Render up to 4 pages (enough for most booking documents)
        const pagesToRender = Math.min(numPages, 4);

        for (let i = 1; i <= pagesToRender; i++) {
            const page = await pdfDoc.getPage(i);
            const scale = 1.5; // Balance between quality and API payload size
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');

            await page.render({ canvasContext: ctx, viewport }).promise;
            const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
            pages.push(base64);
        }

        return pages;
    },

    /**
     * Convert image file to base64, resizing large images (mobile cameras) to max 1280px.
     * Falls back to direct FileReader if canvas/Image fails (e.g. HEIC on some browsers).
     */
    _fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                // Try canvas resize first (reduces payload size for large mobile photos)
                const img = new Image();
                img.onerror = () => {
                    // Canvas approach failed (e.g. HEIC) — send the original data directly
                    console.warn('[GeminiService] Canvas resize failed, using raw file data');
                    const base64 = dataUrl.split(',')[1];
                    if (base64) resolve(base64);
                    else reject(new Error('Could not read image file'));
                };
                img.onload = () => {
                    const MAX = 1280;
                    let { width, height } = img;
                    if (width > MAX || height > MAX) {
                        const ratio = Math.min(MAX / width, MAX / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    const base64 = canvas.toDataURL('image/jpeg', 0.88).split(',')[1];
                    resolve(base64);
                };
                img.src = dataUrl;
            };
            reader.readAsDataURL(file);
        });
    },

    /**
     * Call Gemini Vision API with one or more base64 images
     */
    async _callGemini(base64Images, prompt = null) {
        const url = `${this.API_URL}?key=${this.API_KEY}`;

        // Build parts: prompt + all images
        const parts = [{ text: prompt || this.EXTRACTION_PROMPT }];
        for (const img of base64Images) {
            parts.push({ inline_data: { mime_type: 'image/jpeg', data: img } });
        }

        const requestBody = {
            contents: [{ parts }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 1500
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const msg = err.error?.message || `API error ${response.status}`;
            // Provide friendlier messages for common quota/key errors
            if (response.status === 429) throw new Error('Gemini API quota exceeded. Please try again in a minute.');
            if (response.status === 400) throw new Error('Invalid request to Gemini API. Please check the file format.');
            throw new Error(`Gemini API error: ${msg}`);
        }

        const data = await response.json();
        console.log('[GeminiService] Full response:', JSON.stringify(data).substring(0, 400));

        // Check for blocked/empty response
        const candidate = data?.candidates?.[0];
        if (!candidate) {
            const blockReason = data?.promptFeedback?.blockReason;
            throw new Error(blockReason
                ? `Document blocked by safety filter: ${blockReason}`
                : 'Gemini returned no response. Try a different image.');
        }

        const finishReason = candidate.finishReason;
        if (finishReason === 'SAFETY') {
            throw new Error('Document was flagged by safety filters. Try a different image.');
        }
        if (finishReason === 'RECITATION') {
            throw new Error('Gemini could not process this document. Try a clearer image.');
        }

        const rawText = candidate?.content?.parts?.[0]?.text || '';
        console.log('[GeminiService] Raw text:', rawText.substring(0, 500));

        if (!rawText.trim()) {
            throw new Error('Gemini returned an empty response. The document may be unreadable or too blurry.');
        }

        // Try multiple strategies to extract JSON
        const extracted = this._extractJson(rawText);
        if (!extracted) {
            console.error('[GeminiService] JSON parse failed. Raw text was:', rawText);
            throw new Error('Could not extract data from the document. Make sure it is a clear booking confirmation and try again.');
        }
        return extracted;
    },

    /**
     * Robustly extract JSON from a Gemini response string — 4 strategies
     */
    _extractJson(text) {
        if (!text || !text.trim()) return null;

        // Strategy 1: Strip ```json ... ``` markdown fences then parse
        const stripped = text
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/gi, '')
            .trim();
        try { return JSON.parse(stripped); } catch (_) { }

        // Strategy 2: Find the outermost { ... } block
        const firstBrace = stripped.indexOf('{');
        const lastBrace = stripped.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            const candidate = stripped.slice(firstBrace, lastBrace + 1);
            try { return JSON.parse(candidate); } catch (_) { }
        }

        // Strategy 3: Regex greedy match of any JSON object
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch (_) { }
        }

        // Strategy 4: Try raw text
        try { return JSON.parse(text.trim()); } catch (_) { }

        return null;
    }
};
