/* ========================================
}
            <!--  Scan document to pre-fill trip details -->
            <div style="background:rgba(99,102,241,0.07);border:1.5px dashed rgba(99,102,241,0.35);border-radius:10px;padding:0.85rem 1rem;margin-bottom:1.5rem;text-align:center;">
                <div id="trip_scan_idle">
                    <div style="font-size:1.4rem;margin-bottom:0.3rem;"></div>
                    <p style="margin:0 0 0.6rem;font-size:0.82rem;color:var(--color-text-secondary);">Upload a booking confirmation to pre-fill trip details</p>
                    <label for="trip_doc_input" class="btn btn-secondary" style="cursor:pointer;font-size:0.8rem;padding:0.4rem 1rem;display:inline-flex;align-items:center;gap:0.4rem;">
                        📄 Choose PDF / Images
                    </label>
                    <input type="file" id="trip_doc_input" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style="display:none;" onchange="App._handleTripDocumentScan(this)">
                    <p style="margin:0.5rem 0 0;font-size:0.72rem;color:var(--color-text-secondary);opacity:0.7;">Powered by Gemini Vision AI ✨</p>
                </div>
                <div id="trip_scan_loading" style="display:none;">
                    <div style="font-size:1.4rem;margin-bottom:0.35rem;">🔍</div>
                    <p id="trip_scan_loading_msg" style="margin:0;font-size:0.85rem;color:var(--color-primary);font-weight:500;">Reading document</p>
                </div>
                <div id="trip_scan_result" style="display:none;">
                    <div style="font-size:1.4rem;margin-bottom:0.25rem;"></div>
                    <p id="trip_scan_result_msg" style="margin:0;font-size:0.82rem;color:#4caf50;font-weight:500;"></p>
                    <button onclick="App._resetTripScan()" style="background:none;border:none;color:var(--color-text-secondary);font-size:0.75rem;cursor:pointer;margin-top:0.3rem;text-decoration:underline;">Scan another</button>
                </div>
                <div id="trip_scan_error" style="display:none;">
                    <div style="font-size:1.4rem;margin-bottom:0.25rem;"></div>
                    <p id="trip_scan_error_msg" style="margin:0;font-size:0.82rem;color:#e53935;"></p>
                    <button onclick="App._resetTripScan()" style="background:none;border:none;color:var(--color-text-secondary);font-size:0.75rem;cursor:pointer;margin-top:0.3rem;text-decoration:underline;">Try again</button>
                </div>
            </div>
/* ========================================
   MyTrip - Main Application Logic
   ======================================== */

// Indian Car Models (for self-drive trips)
const INDIAN_CAR_MODELS = {
    "Maruti Suzuki": ["Alto", "Alto K10", "S-Presso", "WagonR", "Celerio", "Swift", "Dzire", "Baleno", "Ignis", "Fronx", "Brezza", "Ertiga", "XL6", "Ciaz", "Grand Vitara", "Jimny"],
    "Hyundai": ["Exter", "i10 NIOS", "i20", "i20 N Line", "Venue", "Venue N Line", "Verna", "Creta", "Creta N Line", "Alcazar", "Tucson", "Ioniq 5"],
    "Tata": ["Tiago", "Tiago NRG", "Tigor", "Tigor EV", "Altroz", "Punch", "Nexon", "Nexon EV", "Harrier", "Safari", "Curvv"],
    "Mahindra": ["XUV300", "XUV400", "XUV700", "XUV 3XO", "Scorpio", "Scorpio N", "Scorpio Classic", "Thar", "Bolero", "Bolero Neo"],
    "Honda": ["Amaze", "City", "City Hybrid", "Elevate"],
    "Toyota": ["Glanza", "Urban Cruiser Taisor", "Rumion", "Hyryder", "Fortuner", "Camry", "Hilux", "Innova Crysta", "Innova Hycross"],
    "Kia": ["Sonet", "Seltos", "Carens", "Carnival", "EV6"],
    "Renault": ["Kwid", "Triber", "Kiger"],
    "Nissan": ["Magnite"],
    "Skoda": ["Kushaq", "Slavia", "Kodiaq", "Superb"],
    "Volkswagen": ["Taigun", "Virtus"],
    "MG": ["Comet", "ZS EV", "Astor", "Hector", "Hector Plus", "Gloster"],
    "Jeep": ["Compass", "Meridian", "Wrangler"],
    "Citroen": ["C3", "C3 Aircross", "eC3"],
    "Force": ["Gurkha", "Trax Cruiser"],
    "BYD": ["e6", "Atto 3"]
};

const App = {
    currentTrip: null,
    currentScreen: 'welcome',

    /**
     * Initialize the application
     */
    init() {
        try {
            console.log('🚀 MyTrip initializing...');

            // CACHE BUSTING: Force update if version mismatch
            // This is a "Hammer" fix for persistent cache issues
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function (registrations) {
                    for (let registration of registrations) {
                        // Optional: Unregister old workers to force fresh install
                        // registration.unregister(); 
                        registration.update();
                    }
                });
            }

            // Set up event listeners
            this.setupEventListeners();

            // Load and display trips (instant from localStorage)
            this.loadTrips();

            // Trigger background sync (non-blocking)
            setTimeout(() => {
                if (window.BackgroundSync && window.AuthService && AuthService.isAuthenticated() && navigator.onLine) {
                    console.log('[App] Triggering background sync');
                    BackgroundSync.syncOnLaunch();
                }
            }, 100);

            console.log('✓ MyTrip ready!');
        } catch (error) {
            console.error('CRITICAL INITIALIZATION ERROR:', error);
            document.body.innerHTML = `
                <div style="padding: 2rem; color: white; text-align: center; font-family: sans-serif;">
                    <h1>⚠️ App Failed to Load</h1>
                    <p>We encountered a critical error initializing the application.</p>
                    <pre style="background: rgba(0,0,0,0.5); padding: 1rem; text-align: left; overflow: auto; border-radius: 8px;">${error.message}\n${error.stack}</pre>
                    <button onclick="location.reload(true)" style="margin-top: 1rem; padding: 0.75rem 1.5rem; border: none; border-radius: 8px; font-size: 1rem; font-weight: bold; cursor: pointer;">
                        Reload App
                    </button>
                    <p style="margin-top: 1rem; font-size: 0.8rem; opacity: 0.7;">Version: v8 | Cache: mytrip-v2.1.0</p>
                </div>
            `;
        }
    },

    /**
     * Set up global event listeners
     */
    setupEventListeners() {
        console.log('📱 Setting up event listeners...');

        // Welcome screen
        const createFirstTripBtn = document.getElementById('createFirstTripBtn');
        if (createFirstTripBtn) {
            console.log('✅ Found createFirstTripBtn');
            createFirstTripBtn.onclick = () => this.showTripForm();
        } else {
            console.warn('⚠️ createFirstTripBtn not found');
        }

        // Trip list screen
        const createTripBtn = document.getElementById('createTripBtn');
        if (createTripBtn) {
            console.log('✅ Found createTripBtn');
            createTripBtn.onclick = () => this.showTripForm();
        } else {
            console.warn('⚠️ createTripBtn not found');
        }

        // Form screen
        const backToListBtn = document.getElementById('backToListBtn');
        if (backToListBtn) {
            console.log('✅ Found backToListBtn');
            backToListBtn.onclick = () => this.showTripList();
        } else {
            console.warn('⚠️ backToListBtn not found');
        }

        console.log('📱 Event listeners setup complete');
    },

    /**
     * Trigger trip import flow
     * Dynamically creates input if missing
     */
    triggerImport() {
        let input = document.getElementById('importTripInput');

        if (!input) {
            console.log('Creating import input dynamically');
            input = document.createElement('input');
            input.type = 'file';
            input.id = 'importTripInput';
            input.accept = '.json';
            input.style.display = 'none';
            document.body.appendChild(input);

            // Attach listener
            input.onchange = (e) => this.handleImportTrip(e);
        } else if (!input.onchange) {
            // Ensure listener is attached even if element exists
            input.onchange = (e) => this.handleImportTrip(e);
        }

        input.click();
    },

    /**
     * Handle trip import
     */
    handleImportTrip(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const tripData = JSON.parse(e.target.result);

                // Basic validation
                if (!tripData.tripName || !tripData.startDate) {
                    throw new Error('Invalid trip format: Missing name or start date');
                }

                // 1. Regenerate Trip ID (Ensure it's treated as NEW)
                const newTripId = this.generateId();
                const oldTripId = tripData.id;

                tripData.id = newTripId;
                tripData.createdAt = new Date().toISOString();
                tripData.updatedAt = new Date().toISOString();
                tripData.syncedAt = null; // Reset sync status

                // 2. Regenerate IDs for all days and link to new trip
                if (tripData.days && Array.isArray(tripData.days)) {
                    tripData.days.forEach(day => {
                        day.id = this.generateId(); // New Day ID
                        day.tripId = newTripId;     // Link to new Trip ID

                        // (Optional: deep regenerate for sub-items if they had IDs, 
                        // but currently sub-items use array index or don't strictly need unique IDs for sync logic yet.
                        // If they do, we would regenerate them here too.)
                    });
                }

                // 3. Save as NEW trip
                if (Storage.saveTrip(tripData)) {
                    UIComponents.showToast('Trip imported successfully as a new copy!', 'success');
                    this.loadTrips(); // Refresh list
                } else {
                    throw new Error('Failed to save imported trip');
                }

            } catch (error) {
                console.error('Import failed:', error);
                UIComponents.showToast('Import failed: ' + error.message, 'error');
            } finally {
                // Clear input so same file can be selected again
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    },

    /**
     * Load trips and show appropriate screen
     */
    loadTrips() {
        const trips = Storage.getTrips();

        if (trips.length === 0) {
            this.showWelcomeScreen();
        } else {
            this.showTripList();
        }
    },

    /**
     * Show welcome screen
     */
    showWelcomeScreen() {
        this.hideAllScreens();
        document.getElementById('welcomeScreen').classList.remove('hidden');
        this.currentScreen = 'welcome';
    },

    /**
     * Show trip list screen
     */
    showTripList() {
        this.hideAllScreens();
        const tripListScreen = document.getElementById('tripListScreen');
        tripListScreen.classList.remove('hidden');

        const tripList = document.getElementById('tripList');
        const trips = Storage.getTrips();

        if (trips.length === 0) {
            tripList.innerHTML = UIComponents.createEmptyState(
                '🗺️',
                'No trips yet',
                'Start planning your first adventure!'
            );
        } else {
            tripList.innerHTML = '';
            trips.forEach(trip => {
                const card = UIComponents.createTripCard(trip);
                tripList.appendChild(card);
            });
        }

        // Add event listeners for delete buttons
        const deleteButtons = document.querySelectorAll('.delete-trip-btn');
        deleteButtons.forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation(); // Prevent card click
                const tripId = btn.getAttribute('data-trip-id');
                this.confirmDeleteTrip(tripId);
            };
        });

        this.currentScreen = 'tripList';
    },

    /**
     * Show trip form (create or edit)
     */
    showTripForm(tripId = null) {
        this.hideAllScreens();
        const formScreen = document.getElementById('tripFormScreen');
        formScreen.classList.remove('hidden');

        // Reset pending pre-bookings accumulator for new/edit trips
        this._pendingPrebookings = tripId ? (this._pendingPrebookings || []) : [];

        const formTitle = document.getElementById('formTitle');
        const tripForm = document.getElementById('tripForm');

        if (tripId) {
            this.currentTrip = Storage.getTrip(tripId);
            formTitle.textContent = 'Edit Trip';
        } else {
            this.currentTrip = this.createNewTrip();
            formTitle.textContent = 'Plan Your Trip';
        }

        this.renderTripForm();
        this.currentScreen = 'tripForm';
    },

    /**
     * Create new trip object
     */
    createNewTrip() {
        return {
            id: this.generateId(),
            tripName: '',
            destination: '', // keeping for backward compatibility
            startDate: '',
            endDate: '',
            adults: 2,
            kids: 0,
            defaultTransportMode: null,
            isSelfDriveTrip: false,
            expectedTotalBudget: 0,
            notes: '',

            // Self-drive vehicle tracking (only if isSelfDriveTrip = true)
            vehicleName: '',
            startingOdometer: null,
            mileage: null, // km/l

            // Rental vehicle support
            isRentalVehicle: false,
            rentalInspection: {
                pickupDate: null,
                pickupLocation: '',
                returnDate: null,
                returnLocation: '',
                rentalCompany: '',
                vehicleCondition: {
                    exterior: '',
                    interior: '',
                    fuel: '',
                    odometer: null
                },
                pickupInspection: {
                    notes: ''
                },
                dropInspection: {
                    notes: ''
                }
            },

            days: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    },

    /**
     * Generate unique ID (UUID-based for cloud compatibility)
     */
    generateId() {
        // Use UUID generator if available, otherwise fallback to timestamp
        if (window.UUIDGenerator) {
            return UUIDGenerator.generate();
        }
        // Fallback for backward compatibility
        return 'trip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Render trip form with conditional logic
     */
    renderTripForm() {
        const form = document.getElementById('tripForm');
        const trip = this.currentTrip;

        form.innerHTML = `
            <!-- Scan document to pre-fill trip details -->
            <div style="background:rgba(99,102,241,0.07);border:1.5px dashed rgba(99,102,241,0.35);border-radius:10px;padding:0.85rem 1rem;margin-bottom:1.5rem;">
                <!-- Scanned documents list (shown when at least one doc is scanned) -->
                <div id="trip_scanned_list" style="display:none;margin-bottom:0.75rem;"></div>

                <!-- Idle state -->
                <div id="trip_scan_idle" style="text-align:center;">
                    <div style="font-size:1.3rem;margin-bottom:0.3rem;">📎</div>
                    <p id="trip_scan_hint" style="margin:0 0 0.6rem;font-size:0.82rem;color:var(--color-text-secondary);">Upload booking confirmations to auto-fill trip details &amp; create pre-bookings</p>
                    <button type="button" class="btn btn-secondary" style="cursor:pointer;font-size:0.8rem;padding:0.4rem 1rem;display:inline-flex;align-items:center;gap:0.4rem;" onclick="event.preventDefault();event.stopPropagation();document.getElementById('trip_doc_input').click();">
                        📄 Choose PDF / Images
                    </button>
                    <input type="file" id="trip_doc_input" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style="display:none;" onchange="App._handleTripDocumentScan(this)">
                    <p style="margin:0.5rem 0 0;font-size:0.72rem;color:var(--color-text-secondary);opacity:0.7;">Powered by Gemini Vision AI ✨</p>
                </div>

                <!-- Loading state -->
                <div id="trip_scan_loading" style="display:none;text-align:center;">
                    <div style="font-size:1.3rem;margin-bottom:0.35rem;">🔍</div>
                    <p id="trip_scan_loading_msg" style="margin:0;font-size:0.85rem;color:var(--color-primary);font-weight:500;">Reading document…</p>
                </div>

                <!-- Error state -->
                <div id="trip_scan_error" style="display:none;text-align:center;">
                    <div style="font-size:1.3rem;margin-bottom:0.25rem;">⚠️</div>
                    <p id="trip_scan_error_msg" style="margin:0;font-size:0.82rem;color:#e53935;"></p>
                    <button onclick="App._resetTripScan()" style="background:none;border:none;color:var(--color-text-secondary);font-size:0.75rem;cursor:pointer;margin-top:0.3rem;text-decoration:underline;">Try again</button>
                </div>
            </div>

            <!-- Trip Name -->
            <div class="form-group">
                <label class="form-label" for="tripName">What should we call this trip?</label>
                <input 
                    type="text" 
                    id="tripName" 
                    class="form-input" 
                    placeholder="e.g., Weekend Getaway to Lonavala"
                    value="${trip.tripName || ''}"
                    required
                >
                <p class="form-hint">Give your trip a memorable name</p>
            </div>
            
            <!-- Destination -->
            <div class="form-group">
                <label class="form-label" for="destination">Where are you heading?</label>
                <input 
                    type="text" 
                    id="destination" 
                    class="form-input" 
                    placeholder="e.g., Lonavala, Maharashtra"
                    value="${trip.destination || ''}"
                    required
                >
            </div>
            
            <!-- Dates -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label class="form-label" for="startDate">Start Date</label>
                    <input 
                        type="date" 
                        id="startDate" 
                        class="form-input"
                        value="${trip.startDate || ''}"
                        required
                    >
                </div>
                <div class="form-group">
                    <label class="form-label" for="endDate">End Date</label>
                    <input 
                        type="date" 
                        id="endDate" 
                        class="form-input"
                        value="${trip.endDate || ''}"
                        required
                    >
                </div>
            </div>
            
            <!-- Adults & Kids -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label class="form-label" for="adults">Adults (18+)</label>
              <input 
                        type="number" 
                        id="adults" 
                        class="form-input"
                        placeholder="e.g., 2"
                        value="${trip.adults || (trip.numberOfTravelers || 1)}"
                        min="0"
                        required
                    >
                </div>
                <div class="form-group">
                    <label class="form-label" for="kids">Kids (0-17)</label>
                    <input 
                        type="number" 
                        id="kids" 
                        class="form-input"
                        placeholder="e.g., 0"
                        value="${trip.kids || 0}"
                        min="0"
                    >
                </div>
            </div>
            
            <!-- Expected Budget -->
            <div class="form-group">
                <label class="form-label" for="expectedTotalBudget">Expected Budget (₹)</label>
                <input 
                    type="number" 
                    id="expectedTotalBudget" 
                    class="form-input"
                    placeholder="e.g., 10000"
                    value="${trip.expectedTotalBudget || 0}"
                    min="0"
                >
            </div>
            
            <!-- Transport Mode (Optional) -->
            <div class="form-group">
                <label class="form-label" for="defaultTransportMode">Default Transport Mode (Optional)</label>
                <select id="defaultTransportMode" class="form-select">
                    <option value="">-- Not Specified --</option>
                    <option value="flight" ${trip.defaultTransportMode === 'flight' ? 'selected' : ''}>✈️ Flight</option>
                    <option value="train" ${trip.defaultTransportMode === 'train' ? 'selected' : ''}>🚂 Train</option>
                    <option value="bus" ${trip.defaultTransportMode === 'bus' ? 'selected' : ''}>🚌 Bus</option>
                    <option value="car" ${trip.defaultTransportMode === 'car' ? 'selected' : ''}>🚗 Car</option>
                    <option value="mixed" ${trip.defaultTransportMode === 'mixed' ? 'selected' : ''}>🚊 Mixed</option>
                </select>
                <p class="form-hint">Can be overridden for individual days</p>
            </div>
            
            <!-- Self-Drive Trip Checkbox -->
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input 
                        type="checkbox" 
                        id="isSelfDriveTrip"
                        ${trip.isSelfDriveTrip ? 'checked' : ''}
                        style="width: 20px; height: 20px; cursor: pointer;"
                    >
                    <span class="form-label" style="margin: 0;">This is a self-drive trip</span>
                </label>
                <p class="form-hint">Enable vehicle and fuel tracking</p>
            </div>
            
            <!-- Vehicle Tracking Section (shown only for self-drive) -->
            <div id="vehicleSection" style="display: ${trip.isSelfDriveTrip ? 'block' : 'none'};">
                <div class="form-group">
                    <label class="form-label" for="vehicleName">Vehicle Name/Model</label>
                    <select 
                        id="vehicleName" 
                        class="form-select"
                    >
                        <option value="">-- Select Vehicle --</option>
                        ${Object.entries(INDIAN_CAR_MODELS).map(([brand, models]) => `
                            <optgroup label="${brand}">
                                ${models.map(model => `
                                    <option value="${brand} ${model}" ${trip.vehicleName === `${brand} ${model}` ? 'selected' : ''}>
                                        ${model}
                                    </option>
                                `).join('')}
                            </optgroup>
                        `).join('')}
                        <option value="other">Other (Manual Entry)</option>
                    </select>
                    <p class="form-hint" style="font-size: 0.75rem; margin-top: 0.25rem;">Select from popular Indian car models</p>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label" for="startingOdometer">Starting Odometer (km)</label>
                        <input 
                            type="number" 
                            id="startingOdometer" 
                            class="form-input"
                            placeholder="e.g., 15000"
                            value="${trip.startingOdometer || ''}"
                            min="0"
                        >
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="mileage">Expected Mileage (km/l)</label>
                        <input 
                            type="number" 
                            id="mileage" 
                            class="form-input"
                            placeholder="e.g., 15"
                            value="${trip.mileage || ''}"
                            min="0"
                            step="0.1"
                        >
                    </div>
                </div>
                <p class="form-hint">We'll track fuel and calculate actual efficiency</p>
                
                <!-- Rental Vehicle Toggle (shown only for self-drive) -->
                <div class="form-group" style="margin-top: 1.5rem;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input 
                            type="checkbox" 
                            id="isRentalVehicle"
                            ${trip.isRentalVehicle ? 'checked' : ''}
                            style="width: 20px; height: 20px; cursor: pointer;"
                        >
                        <span class="form-label" style="margin: 0;">Is this a rented vehicle?</span>
                    </label>
                    <p class="form-hint">Track rental pickup/return and inspection details</p>
                </div>
                
                <!-- Rental Inspection Section (shown only when rental is enabled) -->
                <div id="rentalInspectionSection" style="display: ${trip.isRentalVehicle ? 'block' : 'none'}; margin-top: 1rem; padding: 1rem; background: var(--color-bg-secondary); border-radius: 8px;">
                    <h4 style="margin: 0 0 1rem 0; font-size: 0.875rem; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Rental Inspection</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label class="form-label" for="rentalPickupDate">Pickup Date</label>
                            <input 
                                type="date" 
                                id="rentalPickupDate" 
                                class="form-input"
                                value="${trip.rentalInspection?.pickupDate || ''}"
                            >
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="rentalReturnDate">Return Date</label>
                            <input 
                                type="date" 
                                id="rentalReturnDate" 
                                class="form-input"
                                value="${trip.rentalInspection?.returnDate || ''}"
                            >
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="rentalCompany">Rental Company</label>
                        <input 
                            type="text" 
                            id="rentalCompany" 
                            class="form-input"
                            placeholder="e.g., Zoomcar, Revv, Drivezy"
                            value="${trip.rentalInspection?.rentalCompany || ''}"
                        >
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label class="form-label" for="rentalPickupLocation">Pickup Location</label>
                            <input 
                                type="text" 
                                id="rentalPickupLocation" 
                                class="form-input"
                                placeholder="e.g., Airport, City Center"
                                value="${trip.rentalInspection?.pickupLocation || ''}"
                            >
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="rentalReturnLocation">Return Location</label>
                            <input 
                                type="text" 
                                id="rentalReturnLocation" 
                                class="form-input"
                                placeholder="e.g., Airport, City Center"
                                value="${trip.rentalInspection?.returnLocation || ''}"
                            >
                        </div>
                    </div>
                    
                    <!-- Pickup Inspection Subsection -->
                    <details style="margin-top: 1.5rem; border: 1px solid var(--color-border); border-radius: 8px; padding: 0;">
                        <summary style="padding: 1rem; cursor: pointer; font-weight: 600; font-size: 0.875rem; color: var(--color-text); background: var(--color-bg); border-radius: 8px; user-select: none;">
                            📋 Pickup Inspection
                        </summary>
                        <div style="padding: 1rem; border-top: 1px solid var(--color-border);">
                            <h5 style="margin: 0 0 0.75rem 0; font-size: 0.8rem; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Vehicle Condition at Pickup</h5>
                            
                            <div class="form-group">
                                <label class="form-label" for="rentalConditionExterior">Exterior Condition</label>
                                <textarea 
                                    id="rentalConditionExterior" 
                                    class="form-textarea" 
                                    placeholder="Note any scratches, dents, or damage..."
                                    rows="2"
                                >${trip.rentalInspection?.vehicleCondition?.exterior || ''}</textarea>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label" for="rentalConditionInterior">Interior Condition</label>
                                <textarea 
                                    id="rentalConditionInterior" 
                                    class="form-textarea" 
                                    placeholder="Note any stains, tears, or issues..."
                                    rows="2"
                                >${trip.rentalInspection?.vehicleCondition?.interior || ''}</textarea>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label class="form-label" for="rentalConditionFuel">Fuel Level at Pickup</label>
                                    <select id="rentalConditionFuel" class="form-select">
                                        <option value="">-- Select --</option>
                                        <option value="Full" ${trip.rentalInspection?.vehicleCondition?.fuel === 'Full' ? 'selected' : ''}>Full</option>
                                        <option value="3/4" ${trip.rentalInspection?.vehicleCondition?.fuel === '3/4' ? 'selected' : ''}>3/4</option>
                                        <option value="1/2" ${trip.rentalInspection?.vehicleCondition?.fuel === '1/2' ? 'selected' : ''}>1/2</option>
                                        <option value="1/4" ${trip.rentalInspection?.vehicleCondition?.fuel === '1/4' ? 'selected' : ''}>1/4</option>
                                        <option value="Empty" ${trip.rentalInspection?.vehicleCondition?.fuel === 'Empty' ? 'selected' : ''}>Empty</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="rentalConditionOdometer">Odometer at Pickup (km)</label>
                                    <input 
                                        type="number" 
                                        id="rentalConditionOdometer" 
                                        class="form-input"
                                        placeholder="e.g., 5000"
                                        value="${trip.rentalInspection?.vehicleCondition?.odometer || ''}"
                                        min="0"
                                    >
                                </div>
                            </div>
                            
                            <div class="form-group" style="margin-top: 1rem;">
                                <label class="form-label" for="pickupInspectionNotes">Inspection Notes</label>
                                <textarea 
                                    id="pickupInspectionNotes" 
                                    class="form-textarea" 
                                    placeholder="Add detailed notes about the vehicle condition at pickup..."
                                    rows="3"
                                >${trip.rentalInspection?.pickupInspection?.notes || ''}</textarea>
                            </div>
                            </div>
                        </div>
                    </details>
                    
                    <!-- Drop Inspection Subsection -->
                    <details style="margin-top: 1rem; border: 1px solid var(--color-border); border-radius: 8px; padding: 0;">
                        <summary style="padding: 1rem; cursor: pointer; font-weight: 600; font-size: 0.875rem; color: var(--color-text); background: var(--color-bg); border-radius: 8px; user-select: none;">
                            📋 Drop Inspection
                        </summary>
                        <div style="padding: 1rem; border-top: 1px solid var(--color-border);">
                            <div class="form-group">
                                <label class="form-label" for="dropInspectionNotes">Inspection Notes</label>
                                <textarea 
                                    id="dropInspectionNotes" 
                                    class="form-textarea" 
                                    placeholder="Add notes about the vehicle condition at return..."
                                    rows="3"
                                >${trip.rentalInspection?.dropInspection?.notes || ''}</textarea>
                            </div>
                            </div>
                        </div>
                    </details>
                </div>
            </div>
            
            <!-- Notes -->
            <div class="form-group">
                <label class="form-label" for="notes">Trip Notes (Optional)</label>
                <textarea 
                    id="notes" 
                    class="form-textarea" 
                    placeholder="Add any important details about your trip..."
                >${trip.notes || ''}</textarea>
            </div>
            
            <!-- Form Actions -->
            <div style="display: flex; gap: 0.75rem; padding-top: 1rem; border-top: 1px solid var(--color-border);">
                <button type="button" id="cancelBtn" class="btn btn-secondary" style="flex: 1;">Cancel</button>
                <button type="submit" id="saveBasicBtn" class="btn btn-primary" style="flex: 2;">
                    Save & Plan Days
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                </button>
            </div>
        `;

        // Set up form event listeners
        this.setupFormListeners();
    },

    /**
     * Render travelers list
     */
    renderTravelers() {
        const travelersList = document.getElementById('travelersList');
        const travelers = this.currentTrip.travelers || [];

        if (travelers.length === 0) {
            travelersList.innerHTML = `
                <p class="form-hint" style="margin: 0;">Click "Add Traveler" to add people to this trip</p>
            `;
        } else {
            travelersList.innerHTML = travelers.map((traveler, index) => `
                <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; padding: 0.75rem; background: var(--color-bg-secondary); border-radius: 8px;">
                    <span style="flex: 1; font-weight: 500;">${traveler.name}</span>
                    <span style="color: var(--color-text-secondary); font-size: 0.875rem;">${traveler.age} years</span>
                    <button type="button" class="icon-btn" onclick="app.removeTraveler(${index})" aria-label="Remove">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `).join('');
        }
    },

    /**
     * Set up form event listeners
     */
    setupFormListeners() {
        // Show/hide vehicle section based on self-drive checkbox
        const isSelfDriveCheckbox = document.getElementById('isSelfDriveTrip');
        const vehicleSection = document.getElementById('vehicleSection');

        if (isSelfDriveCheckbox) {
            isSelfDriveCheckbox.onchange = () => {
                const isChecked = isSelfDriveCheckbox.checked;
                vehicleSection.style.display = isChecked ? 'block' : 'none';

                // Also hide rental section if self-drive is disabled
                if (!isChecked) {
                    const isRentalCheckbox = document.getElementById('isRentalVehicle');
                    const rentalSection = document.getElementById('rentalInspectionSection');
                    if (isRentalCheckbox) isRentalCheckbox.checked = false;
                    if (rentalSection) rentalSection.style.display = 'none';
                }
            };
        }

        // Show/hide rental inspection section based on rental checkbox
        const isRentalCheckbox = document.getElementById('isRentalVehicle');
        const rentalInspectionSection = document.getElementById('rentalInspectionSection');

        if (isRentalCheckbox) {
            isRentalCheckbox.onchange = () => {
                rentalInspectionSection.style.display = isRentalCheckbox.checked ? 'block' : 'none';
            };
        }

        // Cancel
        document.getElementById('cancelBtn').onclick = () => {
            if (this.currentTrip.name) {
                this.showTripList();
            } else {
                this.loadTrips();
            }
        };

        // Save basic info and proceed to days
        document.getElementById('tripForm').onsubmit = (e) => {
            e.preventDefault();
            this.saveTrip();
        };
    },

    /**
     * Show Share Trip dialog
     * Owner can add/remove collaborators by email
     */
    showShareTripDialog() {
        const trip = this.currentTrip;
        const userId = AuthService ? AuthService.getUserId() : null;
        const isOwner = !trip.ownerId || trip.ownerId === userId;
        const collaborators = trip.collaborators || [];

        const buildCollaboratorList = () => {
            if (collaborators.length === 0) {
                return `<p style="color:var(--color-text-secondary);font-size:0.875rem;margin:0;">No one else has access yet.</p>`;
            }
            return collaborators
                .filter(uid => uid !== (trip.ownerId || userId)) // hide owner itself
                .map(uid => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--color-border);">
                        <div style="display:flex;align-items:center;gap:0.5rem;">
                            <div style="width:32px;height:32px;border-radius:50%;background:var(--color-primary);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:white;">👤</div>
                            <span style="font-size:0.875rem;color:var(--color-text);font-family:monospace;">${uid.substring(0, 8)}…</span>
                        </div>
                        ${isOwner ? `<button class="btn btn-secondary removeCollaboratorBtn" data-uid="${uid}" style="padding:4px 10px;font-size:0.75rem;color:var(--color-error);border-color:rgba(239,68,68,0.2);">Remove</button>` : ''}
                    </div>
                `).join('');
        };

        const buildModal = () => `
            <div style="max-width:440px;">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem;">
                    <div style="width:40px;height:40px;border-radius:50%;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2">
                            <circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                    </div>
                    <div>
                        <h3 style="margin:0;font-size:1.125rem;">Share Trip</h3>
                        <p style="margin:0;font-size:0.8rem;color:var(--color-text-secondary);">Invite others to view and edit</p>
                    </div>
                </div>

                ${isOwner ? `
                <div class="form-group" style="margin-bottom:1rem;">
                    <label class="form-label" for="collaboratorEmail">Add by Email</label>
                    <input type="email" id="collaboratorEmail" class="form-input" placeholder="friend@example.com" style="width:100%;box-sizing:border-box;margin-bottom:0.5rem;"/>
                    <button id="addCollaboratorBtn" class="btn btn-primary" style="width:100%;">Add Collaborator</button>
                    <p style="margin:0.5rem 0 0 0;font-size:0.75rem;color:var(--color-text-secondary);">They must have signed in to the app at least once.</p>
                </div>` : `<p style="margin-bottom:1rem;font-size:0.875rem;color:var(--color-text-secondary);">You are a collaborator on this trip. Only the owner can manage access.</p>`}

                <div style="margin-bottom:1.5rem;">
                    <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-secondary);margin-bottom:0.75rem;">People with access</div>
                    <div id="collaboratorListContainer">${buildCollaboratorList()}</div>
                </div>

                <div style="display:flex;justify-content:flex-end;">
                    <button id="closeShareModalBtn" class="btn btn-secondary">Done</button>
                </div>
            </div>
        `;

        UIComponents.showModal(buildModal());

        document.getElementById('closeShareModalBtn').onclick = () => UIComponents.closeModal();

        if (isOwner) {
            document.getElementById('addCollaboratorBtn').onclick = async () => {
                const email = document.getElementById('collaboratorEmail').value.trim();
                if (!email) return;

                const btn = document.getElementById('addCollaboratorBtn');
                btn.textContent = 'Adding…';
                btn.disabled = true;

                // Check if SyncServiceEnhanced is available (const doesn't attach to window)
                const syncAvailable = typeof SyncServiceEnhanced !== 'undefined' && SyncServiceEnhanced.canSync();
                if (!syncAvailable) {
                    const notSignedIn = typeof AuthService === 'undefined' || !AuthService.currentUser;
                    UIComponents.showToast(
                        notSignedIn ? 'Please sign in to share trips.' : 'Cloud sync unavailable. Check your connection.',
                        'error', 4000
                    );
                    btn.textContent = 'Add Collaborator';
                    btn.disabled = false;
                    return;
                }

                let result = await SyncServiceEnhanced.addCollaborator(trip.id, email);

                // If trip isn't in Firestore yet, auto-sync it then retry
                if (!result.success && result.needsSync) {
                    UIComponents.showToast('Syncing trip to cloud first…', 'info', 2500);
                    try {
                        await SyncServiceEnhanced.syncTripWithRelations(trip);
                        result = await SyncServiceEnhanced.addCollaborator(trip.id, email);
                    } catch (syncErr) {
                        result = { success: false, error: 'Could not sync trip: ' + syncErr.message };
                    }
                }

                if (result.success) {
                    if (result.pending) {
                        // Pending invite created — they'll get access when they sign in
                        UIComponents.showToast(
                            `📨 Invite sent to ${email}. They'll get access when they sign in to the app.`,
                            'info', 5000
                        );
                    } else {
                        // Immediately added — update local state
                        if (!trip.collaborators) trip.collaborators = [trip.ownerId || userId];
                        if (result.user.uid && !trip.collaborators.includes(result.user.uid)) {
                            trip.collaborators.push(result.user.uid);
                        }
                        Storage.saveTrip(trip);
                        UIComponents.showToast(`✅ Shared with ${result.user.displayName || email}`, 'success', 3000);
                    }
                    document.getElementById('collaboratorEmail').value = '';
                    document.getElementById('collaboratorListContainer').innerHTML = buildCollaboratorList();
                    attachRemoveListeners();
                } else {
                    UIComponents.showToast(result.error || 'Failed to add collaborator', 'error', 4000);
                }

                btn.textContent = 'Add Collaborator';
                btn.disabled = false;
            };
        }

        const attachRemoveListeners = () => {
            document.querySelectorAll('.removeCollaboratorBtn').forEach(btn => {
                btn.onclick = async () => {
                    const uid = btn.dataset.uid;
                    btn.textContent = 'Removing…';
                    btn.disabled = true;

                    if (typeof SyncServiceEnhanced !== 'undefined' && SyncServiceEnhanced.canSync()) {
                        await SyncServiceEnhanced.removeCollaborator(trip.id, uid);
                    }

                    // Update local
                    trip.collaborators = (trip.collaborators || []).filter(c => c !== uid);
                    Storage.saveTrip(trip);
                    UIComponents.showToast('Collaborator removed', 'info', 2000);
                    document.getElementById('collaboratorListContainer').innerHTML = buildCollaboratorList();
                    attachRemoveListeners();
                };
            });
        };
        attachRemoveListeners();
    },

    /**
     * Show add traveler dialog
     */
    showAddTravelerDialog() {
        const content = `
            <h3 style="margin-bottom: 1rem;">Add Traveler</h3>
            <div class="form-group">
                <label class="form-label" for="travelerName">Name</label>
                <input type="text" id="travelerName" class="form-input" placeholder="e.g., John Doe" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="travelerAge">Age</label>
                <input type="number" id="travelerAge" class="form-input" placeholder="e.g., 25" min="0" max="120" required>
            </div>
            <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem;">
                <button id="cancelTravelerBtn" class="btn btn-secondary">Cancel</button>
                <button id="addTravelerConfirmBtn" class="btn btn-primary">Add</button>
            </div>
        `;

        UIComponents.showModal(content);

        document.getElementById('cancelTravelerBtn').onclick = () => {
            UIComponents.closeModal();
        };

        document.getElementById('addTravelerConfirmBtn').onclick = () => {
            const name = document.getElementById('travelerName').value.trim();
            const age = parseInt(document.getElementById('travelerAge').value);

            if (name && age) {
                if (!this.currentTrip.travelers) {
                    this.currentTrip.travelers = [];
                }
                this.currentTrip.travelers.push({ name, age });
                this.renderTravelers();
                UIComponents.closeModal();
            }
        };
    },

    /**
     * Remove traveler
     */
    removeTraveler(index) {
        this.currentTrip.travelers.splice(index, 1);
        this.renderTravelers();
    },

    /**
     * Save basic trip info and proceed to day planning
     */
    saveTrip() {
        // Detect date changes
        const originalStartDate = this.currentTrip.startDate;
        const originalEndDate = this.currentTrip.endDate; // NOTE: This reflects what was loaded into the form initially.
        // Wait, currentTrip.endDate was updated above at line 627. We need the ORIGINAL BEFORE update.
        // We can't access it unless we stored it.
        // Let's refactor: capture form values first into temp variables, then compare.

        const newStartDate = document.getElementById('startDate').value;
        const newEndDate = document.getElementById('endDate').value;

        // Validate dates first
        if (new Date(newStartDate) > new Date(newEndDate)) {
            UIComponents.showToast('End date must be after start date', 'error');
            return;
        }

        const dateChanged = newStartDate !== this.currentTrip.startDate || newEndDate !== this.currentTrip.endDate;
        const hasDays = this.currentTrip.days && this.currentTrip.days.length > 0;

        // Function to proceed with saving
        const performSave = (regenerate = false) => {
            this.currentTrip.tripName = document.getElementById('tripName').value.trim();
            this.currentTrip.destination = document.getElementById('destination').value.trim();
            this.currentTrip.startDate = newStartDate;
            this.currentTrip.endDate = newEndDate;
            this.currentTrip.adults = parseInt(document.getElementById('adults').value) || 1;
            this.currentTrip.kids = parseInt(document.getElementById('kids').value) || 0;
            this.currentTrip.expectedTotalBudget = parseFloat(document.getElementById('expectedTotalBudget').value) || 0;
            this.currentTrip.defaultTransportMode = document.getElementById('defaultTransportMode').value || null;
            this.currentTrip.isSelfDriveTrip = document.getElementById('isSelfDriveTrip').checked;
            this.currentTrip.notes = document.getElementById('notes').value.trim();

            if (this.currentTrip.isSelfDriveTrip) {
                this.currentTrip.vehicleName = document.getElementById('vehicleName').value.trim();
                const startingOdometer = document.getElementById('startingOdometer').value;
                const mileage = document.getElementById('mileage').value;
                this.currentTrip.startingOdometer = startingOdometer ? parseFloat(startingOdometer) : null;
                this.currentTrip.mileage = mileage ? parseFloat(mileage) : null;

                // Capture rental vehicle data
                this.currentTrip.isRentalVehicle = document.getElementById('isRentalVehicle').checked;

                if (this.currentTrip.isRentalVehicle) {
                    const rentalOdometer = document.getElementById('rentalConditionOdometer').value;

                    this.currentTrip.rentalInspection = {
                        pickupDate: document.getElementById('rentalPickupDate').value || null,
                        pickupLocation: document.getElementById('rentalPickupLocation').value.trim(),
                        returnDate: document.getElementById('rentalReturnDate').value || null,
                        returnLocation: document.getElementById('rentalReturnLocation').value.trim(),
                        rentalCompany: document.getElementById('rentalCompany').value.trim(),
                        vehicleCondition: {
                            exterior: document.getElementById('rentalConditionExterior').value.trim(),
                            interior: document.getElementById('rentalConditionInterior').value.trim(),
                            fuel: document.getElementById('rentalConditionFuel').value,
                            odometer: rentalOdometer ? parseFloat(rentalOdometer) : null
                        },
                        pickupInspection: {
                            notes: document.getElementById('pickupInspectionNotes').value.trim()
                        },
                        dropInspection: {
                            notes: document.getElementById('dropInspectionNotes').value.trim()
                        }
                    };
                } else {
                    // Reset rental data if not a rental
                    this.currentTrip.isRentalVehicle = false;
                    this.currentTrip.rentalInspection = {
                        pickupDate: null,
                        pickupLocation: '',
                        returnDate: null,
                        returnLocation: '',
                        rentalCompany: '',
                        vehicleCondition: {
                            exterior: '',
                            interior: '',
                            fuel: '',
                            odometer: null
                        },
                        pickupInspection: {
                            notes: ''
                        },
                        dropInspection: {
                            notes: ''
                        }
                    };
                }
            } else {
                this.currentTrip.vehicleName = '';
                this.currentTrip.startingOdometer = null;
                this.currentTrip.mileage = null;
                this.currentTrip.isRentalVehicle = false;
                this.currentTrip.rentalInspection = {
                    pickupDate: null,
                    pickupLocation: '',
                    returnDate: null,
                    returnLocation: '',
                    rentalCompany: '',
                    vehicleCondition: {
                        exterior: '',
                        interior: '',
                        fuel: '',
                        odometer: null
                    },
                    pickupInspection: {
                        notes: ''
                    },
                    dropInspection: {
                        notes: ''
                    }
                };
            }

            this.currentTrip.updatedAt = new Date().toISOString();

            if (regenerate) {
                this.generateDays();
            }

            // --- Inject any pre-bookings accumulated during document scanning ---
            if (this._pendingPrebookings && this._pendingPrebookings.length > 0) {
                if (!this.currentTrip.prebookings) this.currentTrip.prebookings = [];
                this._pendingPrebookings.forEach(pb => {
                    this.currentTrip.prebookings.push(pb);
                });
                this._pendingPrebookings = [];
            }

            Storage.saveTrip(this.currentTrip);

            // After save, spread Hotel/Rental Car pre-bookings to day splits
            if (this.currentTrip.prebookings && this.currentTrip.prebookings.length > 0) {
                this.currentTrip.prebookings.forEach(pb => {
                    if ((pb.category === 'Hotel' || pb.category === 'Rental Car') && pb.checkIn && pb.checkOut) {
                        this._spreadPrebookingToDays(pb);
                    }
                });
                Storage.saveTrip(this.currentTrip);
            }

            this.showTripDetail(this.currentTrip.id);
            UIComponents.showToast('Trip saved successfully!', 'success');
        };

        if (dateChanged && hasDays) {
            // Check if we can just update the end date if only end date changed and it's later?
            // Requirement says: "Regenerates days only after confirmation"
            // Let's keep it simple: any date change asks for confirmation.
            // Actually, "Prevent accidental data loss" is key.
            // If start date changed -> Needs regeneration (or shift, but regeneration is safer/simpler).
            // If end date changed -> 
            // If shorter: Needs truncation.
            // If longer: Needs appending (simpler to use Add Day logic or regenerate).

            UIComponents.showConfirm(
                'Change Trip Dates?',
                'Changing dates will regenerate the day-wise itinerary. Existing details (meals, expenses) might be lost if dates don\'t align. Are you sure?',
                () => performSave(true) // Regenerate
            );
        } else {
            // No date change, or no days yet
            performSave(!hasDays); // Regenerate only if no days exist
        }
    },

    /**
     * Generate days based on date range
     */
    generateDays() {
        const start = new Date(this.currentTrip.startDate);
        const end = new Date(this.currentTrip.endDate);
        const days = [];

        let dayNumber = 1;
        let previousEndOdometer = this.currentTrip.startingOdometer;

        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            days.push({
                id: this.generateId(),
                tripId: this.currentTrip.id,
                date: date.toISOString().split('T')[0],
                dayNumber: dayNumber++,

                // Odometer tracking (for self-drive trips)
                startOdometer: previousEndOdometer,
                endOdometer: null,

                // Fuel tracking (for self-drive trips)
                fuelFilled: null, // liters
                fuelCost: null,

                // Transport notes and flags
                transportNotes: '',
                noDrivingToday: false,

                // Accommodation
                accommodation: {
                    type: 'hotel',
                    name: '',
                    expectedCost: 0,
                    actualCost: 0,
                    notes: ''
                },

                // Food (structured breakdown)
                food: {
                    breakfast: { expected: 0, actual: 0, venue: '', notes: '' },
                    lunch: { expected: 0, actual: 0, venue: '', notes: '' },
                    dinner: { expected: 0, actual: 0, venue: '', notes: '' }
                },

                // Activities (multiple)
                activities: [],

                // Travel (multiple)
                travel: [],

                // Expenses (multiple)
                expenses: [],

                // Transport override (optional)
                transportOverride: null,

                // Day notes
                dayNotes: ''
            });

            // Update for next day (will be null until user enters endOdometer)
            previousEndOdometer = null;
        }

        this.currentTrip.days = days;
    },

    /**
     * Show trip detail view
     */
    showTripDetail(tripId) {
        this.hideAllScreens();
        const detailScreen = document.getElementById('tripDetailScreen');
        detailScreen.classList.remove('hidden');

        const trip = Storage.getTrip(tripId);
        this.currentTrip = trip;

        // Reconcile expenses from merged sub-entity data (activities, meals, travel, etc.)
        // This ensures budget reflects ALL costs after cross-device Force Sync
        if (this.currentTrip && this.currentTrip.days) {
            this.reconcileAllDays();
            // Save reconciled expenses to localStorage (without triggering cloud sync)
            const trips = Storage.getTrips();
            const idx = trips.findIndex(t => t.id === this.currentTrip.id);
            if (idx !== -1) {
                trips[idx] = this.currentTrip;
                Storage.saveTrips(trips);
            }
        }

        this.renderTripDetail();
        this.currentScreen = 'tripDetail';
    },

    /**
     * Render trip detail view
     */
    renderTripDetail() {
        const content = document.getElementById('tripDetailContent');
        const trip = this.currentTrip;

        const totalExpected = UIComponents.calculateTotalExpected(trip);
        const totalActual = UIComponents.calculateTotalActual(trip);
        const variance = totalActual - totalExpected;

        content.innerHTML = `
            <!-- Header -->
            <div style="margin-bottom: 2rem;">
                <button id="backToListFromDetail" class="icon-btn" style="margin-bottom: 1rem;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                </button>
                
                <div style="display: flex; align-items: start; justify-content: space-between; gap: 1rem;">
                    <div>
                        <h2 style="margin: 0 0 0.5rem 0;">${trip.tripName || trip.name}</h2>
                        <p style="margin: 0; color: var(--color-text-secondary); font-size: 1rem;">
                            📍 ${trip.destination}
                        </p>
                        <p style="margin: 0.5rem 0 0 0; color: var(--color-text-secondary); font-size: 0.875rem;">
                            ${UIComponents.formatDate(trip.startDate)} - ${UIComponents.formatDate(trip.endDate)}
                        </p>
                    </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button id="shareTripBtn" class="btn btn-secondary" style="color: var(--color-primary); border-color: rgba(99,102,241,0.3);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="18" cy="5" r="3"></circle>
                                <circle cx="6" cy="12" r="3"></circle>
                                <circle cx="18" cy="19" r="3"></circle>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                            </svg>
                            Share
                        </button>
                        <button id="deleteTripDetailBtn" class="btn btn-secondary" style="color: var(--color-error); border-color: rgba(239, 68, 68, 0.2);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Delete
                        </button>
                        <button id="editTripBtn" class="btn btn-secondary">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Edit
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Budget Summary -->
            <div class="card budget-overview-card" style="margin-bottom: 2rem; cursor: default; padding: 2rem;">
                <h3 style="margin: 0 0 2rem 0; font-size: 1.125rem; font-weight: 600; color: var(--color-text);">Budget Overview</h3>
                
                ${(() => {
                const percentage = totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0;
                const isOverBudget = totalActual > totalExpected && totalExpected > 0;
                const difference = Math.abs(variance);

                return `
                    <!-- Section 1: Primary Budget Summary -->
                    <div class="budget-primary-summary">
                        <div class="budget-expected-primary">
                            <div class="budget-label-primary">Total Budget</div>
                            <div class="budget-value-primary" style="color: #fbbf24; font-size: 2.25rem; font-weight: 700; margin-top: 0.5rem;">
                                ${UIComponents.formatCurrency(totalExpected)}
                            </div>
                        </div>
                        
                        <div class="budget-actual-primary" style="margin-top: 1.5rem;">
                            <div class="budget-label-primary">Spent</div>
                            <div class="budget-value-primary" style="color: ${isOverBudget ? '#f87171' : '#34d399'}; font-size: 2.25rem; font-weight: 700; margin-top: 0.5rem;">
                                ${totalActual > 0 ? UIComponents.formatCurrency(totalActual) : '-'}
                            </div>
                            ${totalActual > 0 && totalExpected > 0 ? `
                                <div class="budget-status-pill ${isOverBudget ? 'over-budget' : 'under-budget'}" style="
                                    display: inline-block;
                                    padding: 6px 14px;
                                    border-radius: 999px;
                                    font-size: 0.875rem;
                                    font-weight: 600;
                                    margin-top: 0.75rem;
                                    background: ${isOverBudget ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'};
                                    color: ${isOverBudget ? '#f87171' : '#34d399'};
                                    border: 1px solid ${isOverBudget ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'};
                                ">
                                    ${isOverBudget ? '₹' + UIComponents.formatCurrency(difference).replace('₹', '') + ' over budget' : '₹' + UIComponents.formatCurrency(difference).replace('₹', '') + ' under budget'}
                                </div>
                            ` : ''}
                        </div>
                        
                        <!-- Progress Bar -->
                        ${totalExpected > 0 && totalActual > 0 ? `
                            <div class="budget-progress-bar" style="margin: 2rem 0 1.5rem 0;">
                                <div class="progress-track" style="
                                    height: 10px;
                                    background: rgba(255, 255, 255, 0.08);
                                    border-radius: 999px;
                                    overflow: hidden;
                                    position: relative;
                                ">
                                    <div class="progress-fill ${isOverBudget ? 'over-budget' : 'under-budget'}" style="
                                        height: 100%;
                                        width: ${Math.min(percentage, 100)}%;
                                        border-radius: 999px;
                                        background: ${isOverBudget ? 'linear-gradient(90deg, #ef4444, #dc2626)' : 'linear-gradient(90deg, #10b981, #059669)'};
                                        transition: width 200ms ease;
                                    "></div>
                                    ${percentage > 100 ? `
                                        <div style="
                                            position: absolute;
                                            top: 0;
                                            left: 0;
                                            right: 0;
                                            bottom: 0;
                                            background: linear-gradient(90deg, #ef4444, #dc2626);
                                            animation: pulse 2s ease-in-out infinite;
                                        "></div>
                                    ` : ''}
                                </div>
                                <div style="
                                    font-size: 0.75rem;
                                    color: var(--color-text-secondary);
                                    text-align: right;
                                    margin-top: 0.5rem;
                                ">${percentage}% of budget</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Section 3: Informational Message -->
                    ${totalActual > 0 && totalExpected > 0 ? `
                        <div class="budget-info-message ${isOverBudget ? 'warning' : 'success'}" style="
                            padding: 1rem 1.5rem;
                            border-radius: 12px;
                            font-size: 0.9rem;
                            text-align: center;
                            margin-top: 1.5rem;
                            background: ${isOverBudget ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'};
                            color: ${isOverBudget ? '#fca5a5' : '#6ee7b7'};
                            border: 1px solid ${isOverBudget ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'};
                            box-shadow: 0 0 20px ${isOverBudget ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'};
                            font-weight: 500;
                        ">
                            ${isOverBudget
                            ? `⚠️ You overspent by ${UIComponents.formatCurrency(difference)} — ${percentage}% of budget exceeded`
                            : `✅ You saved ${UIComponents.formatCurrency(difference)} — only ${percentage}% of budget used`
                        }
                        </div>
                    ` : ''}
                    `;
            })()}
            </div>
            
            <!-- Fuel Tracking (for car trips) -->
            ${trip.transportMode === 'car' ? `
                <div class="card" style="margin-bottom: 2rem; cursor: default;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                        <h3 style="margin: 0; font-size: 1.125rem;">⛽ Fuel & Mileage</h3>
                        <button id="addFuelBtn" class="btn btn-secondary">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Add Fuel
                        </button>
                    </div>
                    
                    ${trip.vehicle && (trip.vehicle.odometerStart || trip.vehicle.odometerEnd) ? `
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; padding: 1rem; background: var(--color-bg-secondary); border-radius: 8px;">
                            <div>
                                <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">START</div>
                                <div style="font-size: 1.25rem; font-weight: 600;">${trip.vehicle.odometerStart || '-'} km</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">END</div>
                                <div style="font-size: 1.25rem; font-weight: 600;">${trip.vehicle.odometerEnd || '-'} km</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">DISTANCE</div>
                                <div style="font-size: 1.25rem; font-weight: 600; color: var(--color-primary);">
                                    ${trip.vehicle.odometerStart && trip.vehicle.odometerEnd ? (trip.vehicle.odometerEnd - trip.vehicle.odometerStart) + ' km' : '-'}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${trip.vehicle && trip.vehicle.fuelPurchases && trip.vehicle.fuelPurchases.length > 0 ? `
                        <div>
                            <h5 style="font-size: 0.875rem; color: var(--color-text-secondary); margin-bottom: 0.5rem;">FUEL PURCHASES</h5>
                            ${trip.vehicle.fuelPurchases.map(purchase => `
                                <div style="padding: 0.75rem; background: var(--color-bg-secondary); border-radius: 8px; margin-bottom: 0.5rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: start;">
                                        <div style="flex: 1;">
                                            <div style="font-weight: 600; margin-bottom: 0.25rem;">📍 ${purchase.location}</div>
                                            <div style="font-size: 0.875rem; color: var(--color-text-secondary);">
                                                ₹${purchase.pricePerLiter}/L ${purchase.quantity ? `• ${purchase.quantity}L` : ''}
                                            </div>
                                        </div>
                                        <div style="text-align: right;">
                                            <div style="font-size: 1rem; font-weight: 600; color: var(--color-secondary);">${UIComponents.formatCurrency(purchase.totalCost)}</div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                            <div style="margin-top: 1rem; padding: 0.75rem; background: var(--gradient-ocean); color: white; border-radius: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="font-weight: 600;">Total Fuel Cost</div>
                                    <div style="font-size: 1.25rem; font-weight: 700;">
                                        ${UIComponents.formatCurrency(trip.vehicle.fuelPurchases.reduce((sum, p) => sum + p.totalCost, 0))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : '<p style="text-align: center; color: var(--color-text-secondary); padding: 1rem;">No fuel purchases added yet</p>'}
                </div>
            ` : ''}
            
            <!-- Export & Reports -->
            <div style="display: flex; gap: 0.75rem; margin-bottom: 2rem; flex-wrap: wrap;">
                <button id="exportJSONBtn" class="btn btn-secondary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Export JSON
                </button>
                <button id="exportCSVBtn" class="btn btn-secondary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Export CSV
                </button>
            </div>

            <!-- Pre-bookings -->
            <div class="card" style="margin-bottom: 2rem; padding: 1.5rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem;">
                    <h3 style="margin:0; font-size:1.1rem; font-weight:600;">🎫 Pre-bookings</h3>
                    <button id="addPrebookingBtn" class="btn btn-secondary" style="padding:0.5rem 1rem; font-size:0.85rem;">
                        + Add
                    </button>
                </div>
                <div id="prebookingsList"></div>
            </div>

            <!-- Days -->
            <div>
                <h3 style="margin-bottom: 1rem;">Day-wise Plan</h3>
                <div id="daysList"></div>
                
                <div style="margin-top: 1.5rem; text-align: center;">
                    <button id="addDayBtn" class="btn btn-secondary" style="width: 100%; border-style: dashed;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add Day
                    </button>
                </div>
            </div>
        `;

        // Render days
        this.renderDays();

        // Set up event listeners
        document.getElementById('backToListFromDetail').onclick = () => this.showTripList();
        document.getElementById('editTripBtn').onclick = () => this.showTripForm(trip.id);

        const shareBtn = document.getElementById('shareTripBtn');
        if (shareBtn) {
            shareBtn.onclick = () => this.showShareTripDialog();
        }

        const deleteBtn = document.getElementById('deleteTripDetailBtn');
        if (deleteBtn) {
            deleteBtn.onclick = () => this.confirmDeleteTrip(trip.id);
        }

        // Export buttons
        const exportJSONBtn = document.getElementById('exportJSONBtn');
        if (exportJSONBtn) {
            exportJSONBtn.onclick = () => Reports.exportJSON(trip);
        }

        const exportCSVBtn = document.getElementById('exportCSVBtn');
        if (exportCSVBtn) {
            exportCSVBtn.onclick = () => Reports.exportCSV(trip);
        }

        // Pre-bookings
        this.renderPrebookings();
        const addPrebookingBtn = document.getElementById('addPrebookingBtn');
        if (addPrebookingBtn) {
            addPrebookingBtn.onclick = () => this.addPrebooking();
        }
    },

    /**
     * Render the pre-bookings list for the current trip
     */
    renderPrebookings() {
        const container = document.getElementById('prebookingsList');
        if (!container) return;

        const prebookings = (this.currentTrip.prebookings || []);
        if (prebookings.length === 0) {
            container.innerHTML = `
                <p style="color:var(--color-text-secondary); font-size:0.875rem; text-align:center; padding:1.5rem 0; margin:0;">
                    No pre-bookings yet. Tap <strong>+ Add</strong> to track advance payments.
                </p>`;
            return;
        }

        const today = new Date(); today.setHours(0, 0, 0, 0);

        container.innerHTML = prebookings.map(pb => {
            const remaining = (pb.totalAmount || 0) - (pb.advancePaid || 0);
            const dueDate = pb.dueDateForBalance ? new Date(pb.dueDateForBalance) : null;
            const fmt = (amt) => `₹${Number(amt).toLocaleString('en-IN')}`;

            // Status
            let statusClass = 'pb-badge-upcoming';
            let statusLabel = '⚠️ Unpaid';
            let accentColor = '#f5a623';
            let dueChip = '';

            if (pb.paid || remaining <= 0) {
                statusClass = 'pb-badge-paid';
                statusLabel = '✅ Fully Paid';
                accentColor = '#4caf50';
            } else if (dueDate) {
                const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) {
                    statusClass = 'pb-badge-overdue';
                    statusLabel = '🔴 Overdue';
                    accentColor = '#e53935';
                    dueChip = `<span class="pb-due-chip" style="background:rgba(229,57,53,0.12);color:#e53935;">${Math.abs(diffDays)}d overdue</span>`;
                } else if (diffDays === 0) {
                    statusClass = 'pb-badge-overdue';
                    statusLabel = '🔴 Due Today';
                    accentColor = '#e53935';
                    dueChip = `<span class="pb-due-chip" style="background:rgba(229,57,53,0.12);color:#e53935;">Due Today</span>`;
                } else if (diffDays <= 7) {
                    statusClass = 'pb-badge-soon';
                    statusLabel = '⚠️ Due Soon';
                    accentColor = '#ff9800';
                    dueChip = `<span class="pb-due-chip" style="background:rgba(255,152,0,0.12);color:#ff9800;">Due in ${diffDays}d</span>`;
                } else {
                    dueChip = `<span class="pb-due-chip" style="background:rgba(245,166,35,0.1);color:#f5a623;">Due ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>`;
                }
            }

            const catEmoji = { 'Hotel': '🏨', 'Train': '🚂', 'Flight': '✈️', 'Bus': '🚌', 'Activity': '🎯', 'Other': '📌' }[pb.category] || '📌';

            return `
                <div class="prebooking-card" style="border-left:3px solid ${accentColor};" data-pb-id="${pb.id}">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">
                        <div style="flex:1;min-width:0;">
                            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.35rem;">
                                <span style="font-size:1rem;">${catEmoji}</span>
                                <strong style="font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${pb.title}</strong>
                                <span class="pb-badge ${statusClass}">${statusLabel}</span>
                                ${dueChip}
                            </div>
                            <div style="font-size:0.8rem;color:var(--color-text-secondary);display:flex;gap:1rem;flex-wrap:wrap;margin-top:0.25rem;">
                                <span>Total: <strong style="color:var(--color-text);">${fmt(pb.totalAmount)}</strong></span>
                                <span>Paid: <strong style="color:#4caf50;">${fmt(pb.advancePaid)}</strong></span>
                                ${remaining > 0 ? `<span>Balance: <strong style="color:${accentColor};">${fmt(remaining)}</strong></span>` : ''}
                                ${pb.bookingRef ? `<span style="font-family:monospace;opacity:0.7;">${pb.bookingRef}</span>` : ''}
                            </div>
                            ${pb.notes ? `<div style="font-size:0.78rem;color:var(--color-text-secondary);margin-top:0.35rem;font-style:italic;">${pb.notes}</div>` : ''}
                        </div>
                        <div style="display:flex;gap:0.35rem;flex-shrink:0;">
                            ${(!pb.paid && remaining > 0) ? `<button class="pb-action-btn" onclick="App.markPrebookingPaid('${pb.id}')" title="Mark as paid">✅</button>` : ''}
                            <button class="pb-action-btn" onclick="App.editPrebooking('${pb.id}')" title="Edit">✏️</button>
                            <button class="pb-action-btn" onclick="App.deletePrebooking('${pb.id}')" title="Delete" style="color:var(--color-error);">🗑️</button>
                        </div>
                    </div>
                </div>`;
        }).join('');
    },

    /**
     * Open Add Pre-booking modal
     */
    addPrebooking() {
        this._showPrebookingForm(null);
    },

    /**
     * Open Edit Pre-booking modal
     */
    editPrebooking(id) {
        const pb = (this.currentTrip.prebookings || []).find(p => p.id === id);
        if (!pb) return;
        this._showPrebookingForm(pb);
    },

    /**
     * Internal: show the pre-booking add/edit modal (category-aware)
     */
    _showPrebookingForm(pb) {
        const isEdit = !!pb;
        const categories = ['Hotel', 'Rental Car', 'Train', 'Flight', 'Bus', 'Activity', 'Other'];
        const catOptions = categories.map(c =>
            `<option value="${c}" ${pb && pb.category === c ? 'selected' : ''}>${c}</option>`
        ).join('');

        const initialCat = pb ? pb.category : 'Hotel';

        const hotelFields = (cat, pb) => {
            if (cat === 'Hotel') return `
                <div id="pb_hotel_section">
                    <div style="background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.2);border-radius:8px;padding:0.65rem 0.85rem;margin-bottom:0.9rem;font-size:0.78rem;color:#f5a623;">
                        🏨 Hotel costs will be automatically spread across your trip days as nightly accommodation expenses.
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.9rem;">
                        <div class="form-group">
                            <label class="form-label">Check-in Date *</label>
                            <input type="date" id="pb_checkin" class="form-input" value="${pb && pb.checkIn ? pb.checkIn : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Check-out Date *</label>
                            <input type="date" id="pb_checkout" class="form-input" value="${pb && pb.checkOut ? pb.checkOut : ''}">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.9rem;">
                        <div class="form-group">
                            <label class="form-label">Check-in Time</label>
                            <input type="time" id="pb_checkin_time" class="form-input" value="${pb && pb.checkInTime ? pb.checkInTime : '14:00'}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Check-out Time</label>
                            <input type="time" id="pb_checkout_time" class="form-input" value="${pb && pb.checkOutTime ? pb.checkOutTime : '11:00'}">
                        </div>
                    </div>
                </div>`;
            if (cat === 'Rental Car') return `
                <div id="pb_hotel_section">
                    <div style="background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.2);border-radius:8px;padding:0.65rem 0.85rem;margin-bottom:0.9rem;font-size:0.78rem;color:#f5a623;">
                        🚗 Rental cost will be automatically spread as daily travel expenses across the rental period.
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.9rem;">
                        <div class="form-group">
                            <label class="form-label">Pickup Date *</label>
                            <input type="date" id="pb_checkin" class="form-input" value="${pb && pb.checkIn ? pb.checkIn : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Drop-off Date *</label>
                            <input type="date" id="pb_checkout" class="form-input" value="${pb && pb.checkOut ? pb.checkOut : ''}">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.9rem;">
                        <div class="form-group">
                            <label class="form-label">Pickup Time</label>
                            <input type="time" id="pb_checkin_time" class="form-input" value="${pb && pb.checkInTime ? pb.checkInTime : '10:00'}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Drop-off Time</label>
                            <input type="time" id="pb_checkout_time" class="form-input" value="${pb && pb.checkOutTime ? pb.checkOutTime : '10:00'}">
                        </div>
                    </div>
                </div>`;
            return `<div id="pb_hotel_section"></div>`;
        };

        const html = `
            <div style="max-width:440px;">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem;">
                    <div style="width:40px;height:40px;border-radius:50%;background:rgba(245,166,35,0.15);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🎫</div>
                    <div>
                        <h3 style="margin:0;font-size:1.1rem;">${isEdit ? 'Edit' : 'Add'} Pre-booking</h3>
                        <p style="margin:0;font-size:0.78rem;color:var(--color-text-secondary);">Track advance payments &amp; balance due dates</p>
                    </div>
                </div>


                <!-- scan document section -->
                <div style="background:rgba(99,102,241,0.07);border:1.5px dashed rgba(99,102,241,0.35);border-radius:10px;padding:0.85rem 1rem;margin-bottom:1.25rem;text-align:center;">
                    <div id="pb_scan_idle">
                        <div style="font-size:1.4rem;margin-bottom:0.3rem;"></div>
                        <p style="margin:0 0 0.6rem;font-size:0.82rem;color:var(--color-text-secondary);">Upload a ticket, hotel confirmation, or rental bill — AI will fill the fields automatically</p>
                        <label for="pb_doc_input" class="btn btn-secondary" style="cursor:pointer;font-size:0.8rem;padding:0.4rem 1rem;display:inline-flex;align-items:center;gap:0.4rem;">
                             Choose PDF / Image
                        </label>
                        <input type="file" id="pb_doc_input" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style="display:none;" onchange="App._handleDocumentUpload(this)">
                        <p style="margin:0.5rem 0 0;font-size:0.72rem;color:var(--color-text-secondary);opacity:0.7;">Powered by Gemini Vision AI </p>
                    </div>
                    <div id="pb_scan_loading" style="display:none;">
                        <div style="font-size:1.4rem;margin-bottom:0.35rem;"></div>
                        <p style="margin:0;font-size:0.85rem;color:var(--color-primary);font-weight:500;">Reading document</p>
                        <p style="margin:0.25rem 0 0;font-size:0.75rem;color:var(--color-text-secondary);">Gemini is extracting booking details</p>
                    </div>
                    <div id="pb_scan_result" style="display:none;">
                        <div style="font-size:1.4rem;margin-bottom:0.25rem;"></div>
                        <p id="pb_scan_result_msg" style="margin:0;font-size:0.82rem;color:#4caf50;font-weight:500;"></p>
                        <button onclick="App._resetDocumentScan()" style="background:none;border:none;color:var(--color-text-secondary);font-size:0.75rem;cursor:pointer;margin-top:0.3rem;text-decoration:underline;">Scan another</button>
                    </div>
                    <div id="pb_scan_error" style="display:none;">
                        <div style="font-size:1.4rem;margin-bottom:0.25rem;"></div>
                        <p id="pb_scan_error_msg" style="margin:0;font-size:0.82rem;color:#e53935;"></p>
                        <button onclick="App._resetDocumentScan()" style="background:none;border:none;color:var(--color-text-secondary);font-size:0.75rem;cursor:pointer;margin-top:0.3rem;text-decoration:underline;">Try again</button>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom:0.9rem;">
                    <label class="form-label">What's booked? *</label>
                    <input type="text" id="pb_title" class="form-input" placeholder="e.g. Hotel Grand Palace, Rajdhani Express" value="${pb ? pb.title : ''}" maxlength="100">
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.9rem;">
                    <div class="form-group">
                        <label class="form-label">Category *</label>
                        <select id="pb_category" class="form-input" onchange="App._onPbCategoryChange(this.value)">${catOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Booking Ref / PNR</label>
                        <input type="text" id="pb_ref" class="form-input" placeholder="Optional" value="${pb ? (pb.bookingRef || '') : ''}">
                    </div>
                </div>

                <!-- Category-specific date fields -->
                ${hotelFields(initialCat, pb)}

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.9rem;">
                    <div class="form-group">
                        <label class="form-label">Total Amount (₹) *</label>
                        <input type="number" id="pb_total" class="form-input" placeholder="0" min="0" value="${pb ? pb.totalAmount : ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Advance Paid (₹)</label>
                        <input type="number" id="pb_advance" class="form-input" placeholder="0" min="0" value="${pb ? pb.advancePaid : ''}">
                    </div>
                </div>

                <div class="form-group" style="margin-bottom:0.9rem;">
                    <label class="form-label">Balance Due Date</label>
                    <input type="date" id="pb_due" class="form-input" value="${pb ? (pb.dueDateForBalance || '') : ''}">
                    <p style="margin:0.35rem 0 0;font-size:0.75rem;color:var(--color-text-secondary);">Leave blank if no due date or already fully paid</p>
                </div>

                <div class="form-group" style="margin-bottom:1.25rem;">
                    <label class="form-label">Notes</label>
                    <input type="text" id="pb_notes" class="form-input" placeholder="Optional notes" value="${pb ? (pb.notes || '') : ''}">
                </div>

                <div id="pb_form_error" style="color:#e53935;font-size:0.8rem;margin-bottom:0.5rem;display:none;"></div>

                <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
                    <button id="pb_cancel" class="btn btn-secondary">Cancel</button>
                    <button id="pb_save" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Pre-booking'}</button>
                </div>
            </div>`;

        UIComponents.showModal(html);

        document.getElementById('pb_cancel').onclick = () => UIComponents.closeModal();
        document.getElementById('pb_save').onclick = () => this._savePrebooking(pb ? pb.id : null);
    },

    /**
     * Handle category change in prebooking form — swap date fields
     */
    /**
     * Handle document upload — call Gemini Vision API and auto-fill form
     */
    async _handleDocumentUpload(input) {
        const files = input.files && input.files.length > 0 ? Array.from(input.files) : null;
        if (!files) return;

        const fileLabel = files.length === 1 ? files[0].name.substring(0, 30) : `${files.length} files`;

        // Show loading state
        const idle = document.getElementById('pb_scan_idle');
        const loading = document.getElementById('pb_scan_loading');
        const result = document.getElementById('pb_scan_result');
        const error = document.getElementById('pb_scan_error');
        const loadingMsg = loading ? loading.querySelector('p') : null;
        if (idle) idle.style.display = 'none';
        if (loading) loading.style.display = 'block';
        if (loadingMsg) loadingMsg.textContent = `Reading ${fileLabel}…`;
        if (result) result.style.display = 'none';
        if (error) error.style.display = 'none';

        try {
            // Pass array of files — GeminiService handles multi-page PDFs and multiple images
            const data = await GeminiService.analyzeDocument(files);
            console.log('[DocUpload] Gemini extracted:', data);

            // Auto-fill category (trigger change to show date fields)
            if (data.category) {
                const catEl = document.getElementById('pb_category');
                if (catEl) {
                    catEl.value = data.category;
                    this._onPbCategoryChange(data.category);
                }
            }

            // Small delay to let category section render
            await new Promise(r => setTimeout(r, 60));

            // Auto-fill fields
            const setVal = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
            setVal('pb_title', data.title);
            setVal('pb_ref', data.bookingRef);
            setVal('pb_total', data.totalAmount);
            setVal('pb_advance', data.advancePaid || 0);
            setVal('pb_due', data.checkOut);
            setVal('pb_notes', data.notes);
            setVal('pb_checkin', data.checkIn);
            setVal('pb_checkout', data.checkOut);
            setVal('pb_checkin_time', data.checkInTime);
            setVal('pb_checkout_time', data.checkOutTime);

            // Show success
            if (loading) loading.style.display = 'none';
            if (result) result.style.display = 'block';
            const msg = document.getElementById('pb_scan_result_msg');
            if (msg) msg.textContent = `Fields filled from ${fileLabel}`;

        } catch (err) {
            console.error('[DocUpload] Error:', err);
            if (loading) loading.style.display = 'none';
            if (error) error.style.display = 'block';
            const errMsg = document.getElementById('pb_scan_error_msg');
            if (errMsg) errMsg.textContent = err.message || 'Could not read the document';
        }

        // Reset file input so same files can be re-selected
        input.value = '';
    },

    /**
     * Reset scan panel back to idle state
     */
    _resetDocumentScan() {
        const idle = document.getElementById('pb_scan_idle');
        const loading = document.getElementById('pb_scan_loading');
        const result = document.getElementById('pb_scan_result');
        const error = document.getElementById('pb_scan_error');
        if (idle) idle.style.display = 'block';
        if (loading) loading.style.display = 'none';
        if (result) result.style.display = 'none';
        if (error) error.style.display = 'none';
    },
    /**
     * Handle document upload on the TRIP CREATION form
     */
    async _handleTripDocumentScan(input) {
        const files = input.files && input.files.length > 0 ? Array.from(input.files) : null;
        if (!files) return;
        const fileLabel = files.length === 1 ? files[0].name.substring(0, 28) : `${files.length} files`;

        const idle = document.getElementById('trip_scan_idle');
        const loading = document.getElementById('trip_scan_loading');
        const error = document.getElementById('trip_scan_error');
        const loadingMsg = document.getElementById('trip_scan_loading_msg');
        if (idle) idle.style.display = 'none';
        if (loading) loading.style.display = 'block';
        if (loadingMsg) loadingMsg.textContent = `Reading ${fileLabel}...`;
        if (error) error.style.display = 'none';
        // input.value cleared AFTER processing - keeps file blobs accessible during async work

        try {
            const data = await GeminiService.analyzeTripDocument(files);
            console.log('[TripDocScan] extracted:', data);

            if (!this._pendingPrebookings) this._pendingPrebookings = [];

            const setVal = (id, v) => { if (!v && v !== 0) return; const el = document.getElementById(id); if (el) el.value = v; };
            const setCheck = (id, checked, sectionId) => {
                const cb = document.getElementById(id); if (!cb) return;
                cb.checked = !!checked; cb.dispatchEvent(new Event('change'));
                if (sectionId) { const sec = document.getElementById(sectionId); if (sec) sec.style.display = checked ? 'block' : 'none'; }
            };

            // Category priority decides which doc gets to name the trip
            const PRIORITY = { Hotel: 5, Activity: 4, Flight: 3, Train: 3, Bus: 3, 'Rental Car': 2, Other: 1 };
            const incomingPri = PRIORITY[data.category] || 1;
            const existingPri = this._tripNamePriority || 0;
            const canName = incomingPri >= existingPri;
            if (canName) { this._tripNamePriority = incomingPri; }

            // Build pre-booking record
            const checkIn = data.checkIn || data.startDate || data.rentalPickupDate || '';
            const checkOut = data.checkOut || data.endDate || data.rentalReturnDate || '';
            const pb = {
                id: 'pb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                title: data.tripName || data.destination || fileLabel,
                category: data.category || 'Other',
                bookingRef: data.bookingRef || '',
                totalAmount: parseFloat(data.budget) || 0,
                advancePaid: parseFloat(data.advancePaid) || 0,
                dueDateForBalance: checkIn || null,
                checkIn, checkOut, checkInTime: '', checkOutTime: '',
                notes: data.destination ? 'Destination: ' + data.destination : '',
                paid: (parseFloat(data.advancePaid) || 0) >= (parseFloat(data.budget) || 1) && (parseFloat(data.budget) || 0) > 0,
                createdAt: new Date().toISOString()
            };
            this._pendingPrebookings.push(pb);

            // Update trip-level fields using priority rules
            if (canName) {
                setVal('tripName', data.tripName);
                setVal('destination', data.destination);
            }
            // Dates: take earliest start, latest end
            const sdEl = document.getElementById('startDate');
            const edEl = document.getElementById('endDate');
            if (data.startDate) {
                if (!sdEl?.value || data.startDate < sdEl.value) setVal('startDate', data.startDate);
            }
            if (data.endDate) {
                if (!edEl?.value || data.endDate > edEl.value) setVal('endDate', data.endDate);
            }
            const modeMap = { flight: 'flight', train: 'train', bus: 'bus', car: 'car', mixed: 'mixed' };
            if (data.transportMode && modeMap[data.transportMode] && canName) {
                setVal('defaultTransportMode', modeMap[data.transportMode]);
            }

            // Self-drive
            if (data.isSelfDriveTrip) {
                setCheck('isSelfDriveTrip', true, 'vehicleSection');
                if (data.vehicleName) {
                    const vnEl = document.getElementById('vehicleName');
                    if (vnEl) {
                        const match = Array.from(vnEl.options).find(o =>
                            o.value.toLowerCase().includes(data.vehicleName.toLowerCase()) ||
                            data.vehicleName.toLowerCase().includes(o.text.toLowerCase().trim())
                        );
                        if (match) vnEl.value = match.value;
                    }
                }
                // Fill rental fields whenever there is a rentalCompany OR isRentalVehicle flag
                if (data.isRentalVehicle || data.rentalCompany) {
                    setCheck('isRentalVehicle', true, 'rentalInspectionSection');
                    const pd = data.rentalPickupDate || data.startDate;
                    const rd = data.rentalReturnDate || data.endDate;
                    if (pd) { const el = document.getElementById('rentalPickupDate'); if (el) el.value = pd; }
                    if (rd) { const el = document.getElementById('rentalReturnDate'); if (el) el.value = rd; }
                    setVal('rentalCompany', data.rentalCompany);
                    setVal('rentalPickupLocation', data.rentalPickupLocation || data.destination);
                    setVal('rentalReturnLocation', data.rentalReturnLocation || data.destination);
                }
            }

            // Running budget total
            const total = this._pendingPrebookings.reduce((s, p) => s + (p.totalAmount || 0), 0);
            if (total > 0) { const el = document.getElementById('expectedTotalBudget'); if (el) el.value = total; }

            this._renderTripScannedList();
            if (loading) loading.style.display = 'none';
            this._resetTripScan();
            UIComponents.showToast('Pre-booking added (' + (data.category || 'Other') + ') - ' + this._pendingPrebookings.length + ' total', 'success', 2500);

        } catch (err) {
            console.error('[TripDocScan]', err);
            if (loading) loading.style.display = 'none';
            if (error) error.style.display = 'block';
            const em = document.getElementById('trip_scan_error_msg');
            if (em) em.textContent = err.message || 'Could not read the document. Try a clearer image.';
        }
        input.value = '';
    },

    /** Render the running list of scanned docs/pre-bookings inside the scan panel */
    _renderTripScannedList() {
        const container = document.getElementById('trip_scanned_list');
        if (!container || !this._pendingPrebookings || this._pendingPrebookings.length === 0) return;

        const fmt = (n) => n > 0 ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
        const totalBudget = this._pendingPrebookings.reduce((s, p) => s + (p.totalAmount || 0), 0);
        const totalPaid = this._pendingPrebookings.reduce((s, p) => s + (p.advancePaid || 0), 0);

        container.style.display = 'block';
        container.innerHTML = `
            <div style="border-bottom:1px solid rgba(99,102,241,0.2);padding-bottom:0.5rem;margin-bottom:0.5rem;">
                <span style="font-size:0.78rem;font-weight:600;color:var(--color-primary);">📋 ${this._pendingPrebookings.length} booking${this._pendingPrebookings.length > 1 ? 's' : ''} scanned — will be saved as pre-bookings</span>
            </div>
            ${this._pendingPrebookings.map((pb, i) => `
                <div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span style="flex:1;font-size:0.8rem;color:var(--color-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${pb.category} · ${pb.title.substring(0, 22)}</span>
                    <span style="font-size:0.78rem;color:var(--color-text-secondary);white-space:nowrap;">${fmt(pb.totalAmount)}</span>
                    <button onclick="App._removePendingPb(${i})" title="Remove" style="background:none;border:none;color:#e53935;cursor:pointer;font-size:0.8rem;padding:0 0.2rem;">✕</button>
                </div>
            `).join('')}
            <div style="display:flex;justify-content:space-between;padding-top:0.4rem;font-size:0.8rem;">
                <span style="color:var(--color-text-secondary);">Advance paid: <strong style="color:#4caf50;">${fmt(totalPaid)}</strong></span>
                <span style="color:var(--color-text-secondary);">Total: <strong style="color:var(--color-primary);">${fmt(totalBudget)}</strong></span>
            </div>`;

        // Update hint text
        const hint = document.getElementById('trip_scan_hint');
        if (hint) hint.textContent = `Add another document to accumulate more bookings`;
    },

    /** Remove a pending pre-booking by index */
    _removePendingPb(index) {
        if (!this._pendingPrebookings) return;
        this._pendingPrebookings.splice(index, 1);
        // Recalculate budget
        const total = this._pendingPrebookings.reduce((s, p) => s + (p.totalAmount || 0), 0);
        const budgetEl = document.getElementById('expectedTotalBudget');
        if (budgetEl && total >= 0) budgetEl.value = total;
        if (this._pendingPrebookings.length === 0) {
            const container = document.getElementById('trip_scanned_list');
            if (container) container.style.display = 'none';
        } else {
            this._renderTripScannedList();
        }
    },


    _resetTripScan() {
        const idle = document.getElementById('trip_scan_idle');
        const loading = document.getElementById('trip_scan_loading');
        const result = document.getElementById('trip_scan_result');
        const error = document.getElementById('trip_scan_error');
        if (idle) idle.style.display = 'block';
        if (loading) loading.style.display = 'none';
        if (result) result.style.display = 'none';
        if (error) error.style.display = 'none';
    },


    _onPbCategoryChange(cat) {
        const section = document.getElementById('pb_hotel_section');
        if (!section) return;
        if (cat === 'Hotel') {
            section.innerHTML = `
                <div style="background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.2);border-radius:8px;padding:0.65rem 0.85rem;margin-bottom:0.9rem;font-size:0.78rem;color:#f5a623;">
                    🏨 Hotel costs will be automatically spread across your trip days as nightly accommodation expenses.
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.9rem;">
                    <div class="form-group"><label class="form-label">Check-in Date *</label><input type="date" id="pb_checkin" class="form-input"></div>
                    <div class="form-group"><label class="form-label">Check-out Date *</label><input type="date" id="pb_checkout" class="form-input"></div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.9rem;">
                    <div class="form-group"><label class="form-label">Check-in Time</label><input type="time" id="pb_checkin_time" class="form-input" value="14:00"></div>
                    <div class="form-group"><label class="form-label">Check-out Time</label><input type="time" id="pb_checkout_time" class="form-input" value="11:00"></div>
                </div>`;
        } else if (cat === 'Rental Car') {
            section.innerHTML = `
                <div style="background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.2);border-radius:8px;padding:0.65rem 0.85rem;margin-bottom:0.9rem;font-size:0.78rem;color:#f5a623;">
                    🚗 Rental cost will be automatically spread as daily travel expenses across the rental period.
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.9rem;">
                    <div class="form-group"><label class="form-label">Pickup Date *</label><input type="date" id="pb_checkin" class="form-input"></div>
                    <div class="form-group"><label class="form-label">Drop-off Date *</label><input type="date" id="pb_checkout" class="form-input"></div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.9rem;">
                    <div class="form-group"><label class="form-label">Pickup Time</label><input type="time" id="pb_checkin_time" class="form-input" value="10:00"></div>
                    <div class="form-group"><label class="form-label">Drop-off Time</label><input type="time" id="pb_checkout_time" class="form-input" value="10:00"></div>
                </div>`;
        } else {
            section.innerHTML = '';
        }
    },

    /**
     * Save (create or update) a pre-booking
     */
    _savePrebooking(existingId) {
        const title = document.getElementById('pb_title').value.trim();
        const category = document.getElementById('pb_category').value;
        const bookingRef = document.getElementById('pb_ref').value.trim();
        const totalAmount = parseFloat(document.getElementById('pb_total').value) || 0;
        const advancePaid = parseFloat(document.getElementById('pb_advance').value) || 0;
        const dueDateForBalance = document.getElementById('pb_due').value || null;
        const notes = document.getElementById('pb_notes').value.trim();
        const errEl = document.getElementById('pb_form_error');

        // Hotel/Rental Car extra fields
        let checkIn = null, checkOut = null, checkInTime = null, checkOutTime = null;
        if (category === 'Hotel' || category === 'Rental Car') {
            const inEl = document.getElementById('pb_checkin');
            const outEl = document.getElementById('pb_checkout');
            const inTimeEl = document.getElementById('pb_checkin_time');
            const outTimeEl = document.getElementById('pb_checkout_time');
            if (inEl && outEl) {
                checkIn = inEl.value;
                checkOut = outEl.value;
                checkInTime = inTimeEl ? inTimeEl.value : null;
                checkOutTime = outTimeEl ? outTimeEl.value : null;

                if (!checkIn || !checkOut) {
                    errEl.textContent = 'Dates are required for this category.';
                    errEl.style.display = 'block';
                    return;
                }
                if (new Date(checkOut) < new Date(checkIn)) {
                    errEl.textContent = 'Check-out date cannot be before check-in.';
                    errEl.style.display = 'block';
                    return;
                }
            }
        }

        // Validate
        if (!title) { errEl.textContent = 'Please enter a title.'; errEl.style.display = 'block'; return; }
        if (totalAmount <= 0) { errEl.textContent = 'Total amount must be greater than 0.'; errEl.style.display = 'block'; return; }
        if (advancePaid > totalAmount) { errEl.textContent = 'Advance paid cannot exceed total amount.'; errEl.style.display = 'block'; return; }
        errEl.style.display = 'none';

        const trip = this.currentTrip;
        if (!trip.prebookings) trip.prebookings = [];

        let pbObj = null;

        if (existingId) {
            // Edit existing
            const idx = trip.prebookings.findIndex(p => p.id === existingId);
            if (idx !== -1) {
                pbObj = {
                    ...trip.prebookings[idx],
                    title, category, bookingRef, totalAmount, advancePaid,
                    dueDateForBalance, notes,
                    checkIn, checkOut, checkInTime, checkOutTime,
                    paid: advancePaid >= totalAmount,
                    updatedAt: new Date().toISOString()
                };
                trip.prebookings[idx] = pbObj;
            }
        } else {
            // New
            pbObj = {
                id: 'pb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                title, category, bookingRef, totalAmount, advancePaid,
                dueDateForBalance, notes,
                checkIn, checkOut, checkInTime, checkOutTime,
                paid: advancePaid >= totalAmount,
                createdAt: new Date().toISOString()
            };
            trip.prebookings.push(pbObj);
        }

        // Smart spread if dates exist (Hotel or Rental Car)
        if (pbObj && (pbObj.category === 'Hotel' || pbObj.category === 'Rental Car') && pbObj.checkIn && pbObj.checkOut) {
            this._spreadPrebookingToDays(pbObj);
        }

        Storage.saveTrip(trip);
        UIComponents.closeModal();
        this.renderPrebookings();
        this.renderTripDetail(); // Re-render to show updated totals/days
        UIComponents.showToast(existingId ? 'Pre-booking updated' : 'Pre-booking added ✅', 'success', 2500);
    },

    /**
     * Smartly spread a pre-booking cost across trip days
     */
    _spreadPrebookingToDays(pb) {
        if (!this.currentTrip || !this.currentTrip.days || this.currentTrip.days.length === 0) return;

        const days = this.currentTrip.days;
        let modified = false;

        // FIRST CLEAR ANY OLD SPREAD EXPENSES FOR THIS PRE-BOOKING (handles edits)
        days.forEach(day => {
            let dayModified = false;

            // Clear accommodation
            if (day.accommodation && day.accommodation._prebookingRef === pb.id) {
                day.accommodation = null;
                dayModified = true;
            }
            // Clear travel
            if (day.travel) {
                const originalCount = day.travel.length;
                day.travel = day.travel.filter(t => t._prebookingRef !== pb.id);
                if (day.travel.length !== originalCount) dayModified = true;
            }

            if (dayModified) {
                this.reconcileDayExpenses(day);
                modified = true;
            }
        });

        // NOW CALCULATE NEW SPREAD
        const dIn = new Date(pb.checkIn);
        const dOut = new Date(pb.checkOut);

        // Calculate number of days spanned
        let numDays = Math.ceil((dOut - dIn) / (1000 * 60 * 60 * 24));
        if (numDays <= 0) numDays = 1; // Minimum 1 day fallback (same-day booking)

        // Cost per day
        const dailyCost = pb.totalAmount / numDays;

        days.forEach(day => {
            if (!day.date) return;
            const currentDayDate = new Date(day.date);
            currentDayDate.setHours(0, 0, 0, 0);

            // Check if this trip day falls within the booking period (inclusive of check-in, exclusive of check-out for hotels typically, but let's include all days touched)
            // For Hotel: N nights = N days usually. We'll attach the cost to days >= checkIn and < checkOut
            // For Rental: same thing.

            const checkInStart = new Date(dIn); checkInStart.setHours(0, 0, 0, 0);
            const checkOutEnd = new Date(dOut); checkOutEnd.setHours(0, 0, 0, 0);

            if (currentDayDate >= checkInStart && currentDayDate < checkOutEnd) {
                modified = true;

                if (pb.category === 'Hotel') {
                    // Update accommodation for this day
                    day.accommodation = {
                        name: pb.title,
                        type: 'Hotel',
                        actualCost: dailyCost,
                        expectedCost: dailyCost,
                        notes: `Pre-booked (${pb.checkInTime} to ${pb.checkOutTime})`,
                        _prebookingRef: pb.id // Trace back
                    };
                } else if (pb.category === 'Rental Car') {
                    // Update travel array for this day
                    if (!day.travel) day.travel = [];
                    // Remove old rental from this PB if editing
                    day.travel = day.travel.filter(t => t._prebookingRef !== pb.id);
                    // Add new spread record
                    day.travel.push({
                        id: 'tvl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                        type: 'Rental Car',
                        from: 'Rental',
                        to: 'Rental',
                        actualCost: dailyCost,
                        expectedCost: dailyCost,
                        splitBetween: this.currentTrip.numberOfTravelers || 1,
                        _prebookingRef: pb.id
                    });
                }

                // Reconcile this day so that auto-expenses rebuild
                this.reconcileDayExpenses(day);
            }
        });

        // per-day reconcileDayExpenses above updates each day's totals — no global call needed
    },

    /**
     * Delete a pre-booking
     */
    deletePrebooking(id) {
        if (!confirm('Delete this pre-booking?')) return;
        const trip = this.currentTrip;

        // Remove from prebookings array
        trip.prebookings = (trip.prebookings || []).filter(p => p.id !== id);

        // Clean up spread expenses from days
        let modified = false;
        if (trip.days) {
            trip.days.forEach(day => {
                let dayModified = false;

                // Clear linked accommodation
                if (day.accommodation && day.accommodation._prebookingRef === id) {
                    day.accommodation = null;
                    dayModified = true;
                }

                // Clear linked travel
                if (day.travel) {
                    const originalCount = day.travel.length;
                    day.travel = day.travel.filter(t => t._prebookingRef !== id);
                    if (day.travel.length !== originalCount) dayModified = true;
                }

                if (dayModified) {
                    this.reconcileDayExpenses(day);
                    modified = true;
                }
            });
        }

        // per-day reconcileDayExpenses above updates each day's totals — no global call needed

        Storage.saveTrip(trip);
        this.renderPrebookings();
        this.renderTripDetail(); // Re-render to reflect cleaned days
        UIComponents.showToast('Pre-booking deleted', 'info', 2000);
    },

    /**
     * Mark a pre-booking as fully paid
     */
    markPrebookingPaid(id) {
        const trip = this.currentTrip;
        const pb = (trip.prebookings || []).find(p => p.id === id);
        if (!pb) return;
        pb.paid = true;
        pb.advancePaid = pb.totalAmount; // fully paid
        pb.updatedAt = new Date().toISOString();
        Storage.saveTrip(trip);
        this.renderPrebookings();
        UIComponents.showToast('Marked as fully paid ✅', 'success', 2000);
    },

    /**
     * Render days list
     */
    renderDays() {
        const daysList = document.getElementById('daysList');
        const days = this.currentTrip.days || [];

        daysList.innerHTML = days.map(day => this.createDayCard(day)).join('');

        // Set up day card listeners
        days.forEach(day => {
            const addActivityBtn = document.getElementById(`addActivity_${day.id}`);
            if (addActivityBtn) {
                addActivityBtn.onclick = () => this.showAddActivityDialog(day.id);
            }

            const addMealBtn = document.getElementById(`addMeal_${day.id}`);
            if (addMealBtn) {
                addMealBtn.onclick = () => this.showAddMealDialog(day.id);
            }

            const addAccommodationBtn = document.getElementById(`addAccommodation_${day.id}`);
            if (addAccommodationBtn) {
                addAccommodationBtn.onclick = () => this.showAddAccommodationDialog(day.id);
            }

            const deleteDayBtn = document.getElementById(`deleteDay_${day.id}`);
            if (deleteDayBtn) {
                deleteDayBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.confirmDeleteDay(day.id);
                };
            }

            // Meal Edit/Delete Listeners
            if (day.meals) {
                day.meals.forEach(meal => {
                    const editBtn = document.getElementById(`editMeal_${day.id}_${meal.id}`);
                    if (editBtn) {
                        editBtn.onclick = () => this.showAddMealDialog(day.id, meal.id);
                    }
                    const deleteBtn = document.getElementById(`deleteMeal_${day.id}_${meal.id}`);
                    if (deleteBtn) {
                        deleteBtn.onclick = () => this.deleteMeal(day.id, meal.id);
                    }
                });
            }

            // Activity Edit/Delete Listeners
            if (day.activities) {
                day.activities.forEach(activity => {
                    const editBtn = document.getElementById(`editActivity_${day.id}_${activity.id}`);
                    if (editBtn) {
                        editBtn.onclick = () => this.showAddActivityDialog(day.id, activity.id);
                    }
                    const deleteBtn = document.getElementById(`deleteActivity_${day.id}_${activity.id}`);
                    if (deleteBtn) {
                        deleteBtn.onclick = () => this.deleteActivity(day.id, activity.id);
                    }
                });
            }

            // Travel button listener
            const addTravelBtn = document.getElementById(`addTravel_${day.id}`);
            if (addTravelBtn) {
                addTravelBtn.onclick = () => this.showTravelForm(day.id);
            }

            // Travel Edit/Delete Listeners
            if (day.travel) {
                day.travel.forEach(travel => {
                    const editBtn = document.getElementById(`editTravel_${day.id}_${travel.id}`);
                    if (editBtn) {
                        editBtn.onclick = () => this.showTravelForm(day.id, travel);
                    }
                    const deleteBtn = document.getElementById(`deleteTravel_${day.id}_${travel.id}`);
                    if (deleteBtn) {
                        deleteBtn.onclick = () => this.deleteTravel(day.id, travel.id);
                    }
                });
            }

            // Accommodation Edit/Delete Listeners
            if (day.accommodation) {
                const editAccBtn = document.getElementById(`editAcc_${day.id}`);
                if (editAccBtn) {
                    editAccBtn.onclick = () => this.showAddAccommodationDialog(day.id);
                }
                const deleteAccBtn = document.getElementById(`deleteAcc_${day.id}`);
                if (deleteAccBtn) {
                    deleteAccBtn.onclick = () => this.deleteAccommodation(day.id);
                }
            }
        });

        // Set up fuel button if vehicle tracking is enabled
        if (this.currentTrip.transportMode === 'car') {
            const addFuelBtn = document.getElementById('addFuelBtn');
            if (addFuelBtn) {
                addFuelBtn.onclick = () => this.showAddFuelDialog();
            }
        }

        // Set up update odometer buttons for self-drive trips
        if (this.currentTrip.isSelfDriveTrip) {
            this.currentTrip.days.forEach(day => {
                const updateOdometerBtn = document.getElementById(`updateOdometer_${day.id}`);
                if (updateOdometerBtn) {
                    updateOdometerBtn.onclick = () => this.showUpdateOdometerDialog(day.id);
                }
            });
        }

        // Add Day Button Listener (Global for the list)
        const addDayBtn = document.getElementById('addDayBtn');
        if (addDayBtn) {
            addDayBtn.onclick = () => this.addDayToTrip();
        }

        // Delete Day Listeners
        days.forEach(day => {
            const deleteDayBtn = document.getElementById(`deleteDayBtn_${day.id}`);
            if (deleteDayBtn) {
                deleteDayBtn.onclick = (e) => {
                    e.stopPropagation(); // prevent card click
                    this.confirmDeleteDay(day.id);
                };
            }
        });
    },

    /**
     * Create day card HTML
     */
    createDayCard(day) {
        const date = day.date ? new Date(day.date) : null;
        const dayName = date && !isNaN(date) ? date.toLocaleDateString('en-IN', { weekday: 'long' }) : 'Unknown';
        const isIncomplete = this.isDayIncomplete(day);

        return `
            <div class="card" style="margin-bottom: 1rem; cursor: default;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div>
                            <h4 style="margin: 0; font-size: 1.125rem;">Day ${day.dayNumber} - ${dayName}</h4>
                            <p style="margin: 0.25rem 0 0 0; color: var(--color-text-secondary); font-size: 0.875rem;">
                                ${UIComponents.formatDate(day.date)}
                            </p>
                        </div>
                        ${isIncomplete ? `<span id="incompleteIndicator_${day.id}" title="Some expenses are incomplete" style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.25rem 0.5rem;background:rgba(251,146,60,0.1);border:1px solid rgba(251,146,60,0.3);border-radius:12px;font-size:0.7rem;color:rgb(234,88,12);font-weight:500;cursor:pointer;"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" opacity="0.9"/></svg>Incomplete</span>` : ''}
                        
                        <button id="deleteDay_${day.id}" title="Delete Day" style="background: none; border: none; cursor: pointer; opacity: 0.5; padding: 4px; display: flex; align-items: center; margin-left: 0.25rem; color: var(--color-text-secondary); transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.75rem; color: var(--color-text-secondary); display: block;">Total Actual</span>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span style="font-weight: 700; color: var(--color-secondary); font-size: 1rem;">
                                ${UIComponents.formatCurrency(this.calculateDayTotal(day).actual)}
                            </span>
                            ${(() => {
                const { variance, actual } = this.calculateDayTotal(day);
                if (variance && variance !== 0 && actual > 0) {
                    const isPositive = variance > 0; // Positive = Over budget
                    return `
                                        <span style="font-size: 0.75rem; font-weight: 600; color: ${isPositive ? 'var(--color-error)' : 'var(--color-success)'};">
                                            ${isPositive ? '+' : ''}${UIComponents.formatCurrency(Math.abs(variance))}
                                        </span>
                                    `;
                }
                return '';
            })()}
                        </div>
                    </div>
                </div>
                
                ${day.meals && day.meals.length > 0 ? `
                    <div style="margin-bottom: 1rem;">
                        <div class="cat-chip meal">🍽 MEAL</div>
                        ${day.meals.map(meal => `
                            <div class="item-card meal">
                                <div style="display: flex; justify-content: space-between; align-items: start;">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; margin-bottom: 0.25rem;">${this.getMealIcon(meal.type)} ${meal.type.charAt(0).toUpperCase() + meal.type.slice(1)}</div>
                                        <div style="font-size: 0.875rem; color: var(--color-text-secondary);">
                                            ${meal.venue} ${meal.restaurantName ? `• ${meal.restaurantName}` : ''}
                                        </div>
                                        ${meal.notes ? `<div style="font-size: 0.875rem; color: var(--color-text-secondary); margin-top: 0.25rem;">${meal.notes}</div>` : ''}
                                        
                                        <div style="display: flex; gap: 0.75rem; margin-top: 0.75rem; border-top: 1px solid var(--color-border); padding-top: 0.75rem;">
                                            <button id="editMeal_${day.id}_${meal.id}" class="btn-action" style="font-size: 0.875rem; display: flex; align-items: center; gap: 0.25rem; color: var(--color-primary); background: rgba(59, 130, 246, 0.1); padding: 0.35rem 0.75rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 500;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                </svg>
                                                Edit
                                            </button>
                                            <button id="deleteMeal_${day.id}_${meal.id}" class="btn-action" style="font-size: 0.875rem; display: flex; align-items: center; gap: 0.25rem; color: var(--color-error); background: rgba(239, 68, 68, 0.1); padding: 0.35rem 0.75rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 500;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        ${meal.expectedCost > 0 ? `
                                            <div style="font-size: 0.75rem; color: var(--color-text-secondary);">Expected</div>
                                            <div style="font-weight: 600; color: var(--color-primary);">${UIComponents.formatCurrency(meal.expectedCost)}</div>
                                        ` : ''}
                                        ${meal.actualCost > 0 ? `
                                            <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem;">Actual</div>
                                            <div style="font-weight: 600; color: var(--color-secondary);">${UIComponents.formatCurrency(meal.actualCost)}</div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${day.activities && day.activities.length > 0 ? `
                    <div style="margin-bottom: 1rem;">
                        <div class="cat-chip activity">⭐ ACTIVITY</div>
                        ${day.activities.map(activity => `
                            <div class="item-card activity">
                                <div style="display: flex; justify-content: space-between; align-items: start;">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; margin-bottom: 0.25rem;">${activity.name}</div>
                                        ${activity.notes ? `<div style="font-size: 0.875rem; color: var(--color-text-secondary);">${activity.notes}</div>` : ''}
                                        
                                        <div style="display: flex; gap: 0.75rem; margin-top: 0.75rem; border-top: 1px solid var(--color-border); padding-top: 0.75rem;">
                                            <button id="editActivity_${day.id}_${activity.id}" class="btn-action" style="font-size: 0.875rem; display: flex; align-items: center; gap: 0.25rem; color: var(--color-primary); background: rgba(59, 130, 246, 0.1); padding: 0.35rem 0.75rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 500;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                </svg>
                                                Edit
                                            </button>
                                            <button id="deleteActivity_${day.id}_${activity.id}" class="btn-action" style="font-size: 0.875rem; display: flex; align-items: center; gap: 0.25rem; color: var(--color-error); background: rgba(239, 68, 68, 0.1); padding: 0.35rem 0.75rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 500;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 0.75rem; color: var(--color-text-secondary);">Expected</div>
                                        <div style="font-weight: 600; color: var(--color-primary);">${UIComponents.formatCurrency(activity.expectedCost)}</div>
                                        ${activity.actualCost ? `
                                            <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem;">Actual</div>
                                            <div style="font-weight: 600; color: var(--color-secondary);">${UIComponents.formatCurrency(activity.actualCost)}</div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${day.travel && day.travel.length > 0 ? `
                    <div style="margin-bottom: 1rem;">
                        <div class="cat-chip travel">✈ TRAVEL</div>
                        ${day.travel.map(travel => `
                            <div class="item-card travel">
                                <div style="display: flex; justify-content: space-between; align-items: start;">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; margin-bottom: 0.25rem;">🚗 ${travel.type}${travel.time ? ` • ${travel.time}` : ''}</div>
                                        <div style="font-size: 0.875rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">
                                            ${travel.from} → ${travel.to}
                                        </div>
                                        ${travel.splitBetween > 1 ? `<div style="font-size: 0.75rem; color: var(--color-text-tertiary);">Split: ${travel.splitBetween} people</div>` : ''}
                                        ${travel.notes ? `<div style="font-size: 0.875rem; color: var(--color-text-secondary); margin-top: 0.25rem;">${travel.notes}</div>` : ''}
                                        
                                        <div style="display: flex; gap: 0.75rem; margin-top: 0.75rem; border-top: 1px solid var(--color-border); padding-top: 0.75rem;">
                                            <button id="editTravel_${day.id}_${travel.id}" class="btn-action" style="font-size: 0.875rem; display: flex; align-items: center; gap: 0.25rem; color: var(--color-primary); background: rgba(59, 130, 246, 0.1); padding: 0.35rem 0.75rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 500;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                </svg>
                                                Edit
                                            </button>
                                            <button id="deleteTravel_${day.id}_${travel.id}" class="btn-action" style="font-size: 0.875rem; display: flex; align-items: center; gap: 0.25rem; color: var(--color-error); background: rgba(239, 68, 68, 0.1); padding: 0.35rem 0.75rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 500;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 0.75rem; color: var(--color-text-secondary);">Expected</div>
                                        <div style="font-weight: 600; color: var(--color-primary);">${UIComponents.formatCurrency(travel.expectedCost)}</div>
                                        ${travel.actualCost ? `
                                            <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem;">Actual</div>
                                            <div style="font-weight: 600; color: var(--color-secondary);">${UIComponents.formatCurrency(travel.actualCost)}</div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${this.currentTrip.isSelfDriveTrip ? this.renderSelfDriveDay(day) : ''}

                ${day.accommodation && day.accommodation.name ? `
                    <div style="margin-bottom: 1rem;">
                        <div class="cat-chip stay">🛏 STAY</div>
                        <div class="item-card stay">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; margin-bottom: 0.25rem;">🏨 ${day.accommodation.name}</div>
                                    <div style="font-size: 0.875rem; color: var(--color-text-secondary);">
                                        ${day.accommodation.type || 'Hotel'}
                                    </div>
                                    ${day.accommodation.notes ? `<div style="font-size: 0.875rem; color: var(--color-text-secondary); margin-top: 0.25rem;">${day.accommodation.notes}</div>` : ''}
                                    
                                    <div style="display: flex; gap: 0.75rem; margin-top: 0.75rem; border-top: 1px solid var(--color-border); padding-top: 0.75rem;">
                                        <button id="editAcc_${day.id}" class="btn-action" style="font-size: 0.875rem; display: flex; align-items: center; gap: 0.25rem; color: var(--color-primary); background: rgba(59, 130, 246, 0.1); padding: 0.35rem 0.75rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 500;">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                            Edit
                                        </button>
                                        <button id="deleteAcc_${day.id}" class="btn-action" style="font-size: 0.875rem; display: flex; align-items: center; gap: 0.25rem; color: var(--color-error); background: rgba(239, 68, 68, 0.1); padding: 0.35rem 0.75rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 500;">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    ${day.accommodation.expectedCost > 0 ? `
                                        <div style="font-size: 0.75rem; color: var(--color-text-secondary);">Expected</div>
                                        <div style="font-weight: 600; color: var(--color-primary);">${UIComponents.formatCurrency(day.accommodation.expectedCost)}</div>
                                    ` : ''}
                                    ${day.accommodation.actualCost > 0 ? `
                                        <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem;">Actual</div>
                                        <div style="font-weight: 600; color: var(--color-secondary);">${UIComponents.formatCurrency(day.accommodation.actualCost)}</div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.5rem;">
                    <button id="addMeal_${day.id}" class="cat-pill-btn meal">🍽 Meal</button>
                    <button id="addActivity_${day.id}" class="cat-pill-btn activity">⭐ Activity</button>
                    <button id="addTravel_${day.id}" class="cat-pill-btn travel">✈ Travel</button>
                    <button id="addAccommodation_${day.id}" class="cat-pill-btn stay">🛏 Stay</button>
                </div>
            </div>
        `;
    },

    /**
     * Get meal icon
     */
    getMealIcon(type) {
        const icons = {
            breakfast: '🍳',
            lunch: '🍱',
            dinner: '🍽️',
            snacks: '🍿'
        };
        return icons[type] || '🍴';
    },

    /**
     * Render self-drive tracking section for a day
     */
    renderSelfDriveDay(day) {
        // Handle no driving today case
        if (day.noDrivingToday) {
            return `
                <div style="background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; color: white;">
                    <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="this.nextElementSibling.classList.toggle('hidden')">
                        <h5 style="margin: 0; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.9;">🅿️ Self-Drive Details</h5>
                        <span style="font-size: 1.25rem; opacity: 0.7;">▼</span>
                    </div>
                    <div class="hidden" style="margin-top: 1rem;">
                        <div style="padding: 1rem; background: rgba(255,255,255,0.1); border-radius: 6px; margin-bottom: 1rem; text-align: center; font-size: 0.875rem;">
                            Rest day - No vehicle usage
                        </div>
                        ${day.transportNotes ? `
                            <div style="padding: 0.75rem; background: rgba(255,255,255,0.1); border-radius: 6px; margin-bottom: 1rem;">
                                <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.25rem;">NOTES</div>
                                <div style="font-size: 0.875rem;">${day.transportNotes}</div>
                            </div>
                        ` : ''}
                        <button id="updateOdometer_${day.id}" class="btn btn-secondary" style="width: 100%; background: rgba(255,255,255,0.9); color: #64748b; border: none; font-weight: 600;">
                            Update Transport Info
                        </button>
                    </div>
                </div>
            `;
        }

        const hasOdometer = day.startOdometer != null && day.endOdometer != null;
        const distance = hasOdometer ? day.endOdometer - day.startOdometer : null;
        const hasFuel = day.fuelFilled !== null && day.fuelFilled > 0;
        const efficiency = hasFuel && distance ? (distance / day.fuelFilled).toFixed(1) : null;
        const expectedMileage = this.currentTrip.mileage;

        return `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; color: white;">
                <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="this.nextElementSibling.classList.toggle('hidden')">
                    <h5 style="margin: 0; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.9;">🚗 Self-Drive Details</h5>
                    <span style="font-size: 1.25rem; opacity: 0.7;">▼</span>
                </div>
                
                <div class="hidden" style="margin-top: 1rem;">
                    ${hasOdometer ? `
                        <div style="display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 0.5rem; align-items: center; margin-bottom: 1rem;">
                            <div>
                                <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.25rem;">START</div>
                                <div style="background: rgba(255,255,255,0.2); padding: 0.5rem; border-radius: 6px; font-weight: 600; font-size: 1.125rem; text-align: center;">
                                    ${day.startOdometer.toLocaleString()} km
                                </div>
                            </div>
                            <div style="font-size: 1.5rem; opacity: 0.6;">→</div>
                            <div>
                                <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.25rem;">END</div>
                                <div style="background: rgba(255,255,255,0.2); padding: 0.5rem; border-radius: 6px; font-weight: 600; font-size: 1.125rem; text-align: center;">
                                    ${day.endOdometer.toLocaleString()} km
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.25rem;">DISTANCE</div>
                                <div style="background: rgba(255,255,255,0.3); padding: 0.5rem; border-radius: 6px; font-weight: 700; font-size: 1.125rem;">
                                    ${distance} km
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div style="padding: 1rem; background: rgba(255,255,255,0.1); border-radius: 6px; margin-bottom: 1rem; text-align: center; font-size: 0.875rem; opacity: 0.8;">
                            No odometer data yet
                        </div>
                    `}
                    
                    ${hasFuel ? `
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                            <div>
                                <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.25rem;">FUEL FILLED</div>
                                <div style="background: rgba(255,255,255,0.2); padding: 0.5rem; border-radius: 6px; font-weight: 600;">
                                    ${day.fuelFilled} L
                                </div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.25rem;">FUEL COST</div>
                                <div style="background: rgba(255,255,255,0.2); padding: 0.5rem; border-radius: 6px; font-weight: 600;">
                                    ${UIComponents.formatCurrency(day.fuelCost || 0)}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${efficiency ? `
                        <div style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.15); border-radius: 6px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.25rem;">EFFICIENCY</div>
                                    <div style="font-weight: 700; font-size: 1.25rem;">${efficiency} km/l</div>
                                </div>
                                ${expectedMileage ? `
                                    <div style="text-align: right;">
                                        <div style="font-size: 0.75rem; opacity: 0.8;">Expected: ${expectedMileage} km/l</div>
                                        <div style="font-size: 0.875rem; font-weight: 600;">
                                            ${efficiency >= expectedMileage ? '✅ Better!' : '⚠️ Lower'}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${day.transportNotes ? `
                        <div style="padding: 0.75rem; background: rgba(255,255,255,0.1); border-radius: 6px; margin-bottom: 1rem;">
                            <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.25rem;">NOTES</div>
                            <div style="font-size: 0.875rem;">${day.transportNotes}</div>
                        </div>
                    ` : ''}
                    
                    <button id="updateOdometer_${day.id}" class="btn btn-secondary" style="width: 100%; background: rgba(255,255,255,0.9); color: #764ba2; border: none; font-weight: 600;">
                        ${hasOdometer ? 'Update' : 'Add'} Odometer & Fuel
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Get previous day with odometer reading (skipping no-driving days)
     */
    getPreviousDay(currentDay) {
        const currentIndex = this.currentTrip.days.findIndex(d => d.id === currentDay.id);
        if (currentIndex <= 0) return null;

        // Look backwards for the last day with an endOdometer reading
        for (let i = currentIndex - 1; i >= 0; i--) {
            const day = this.currentTrip.days[i];
            if (day.endOdometer !== null && !day.noDrivingToday) {
                return day;
            }
        }

        return null;
    },

    /**
     * Get auto start odometer for a day (handles no-driving gaps)
     */
    getAutoStartOdometer(day) {
        const prevDay = this.getPreviousDay(day);
        return prevDay?.endOdometer || this.currentTrip.startingOdometer;
    },

    /**
     * Show add/edit activity dialog
     */
    showAddActivityDialog(dayId, activityId = null) {
        const day = this.currentTrip.days.find(d => d.id === dayId);
        if (!day) return;

        let existingActivity = null;
        if (activityId && day.activities) {
            existingActivity = day.activities.find(a => a.id === activityId);
        }

        const content = `
            <h3 style="margin-bottom: 1rem;">${existingActivity ? 'Edit Activity' : 'Add Activity'}</h3>
            <form id="activityForm">
                <div class="form-group">
                    <label class="form-label" for="activityName">What will you do?</label>
                    <input type="text" id="activityName" class="form-input" placeholder="e.g., Visit beach" value="${existingActivity ? existingActivity.name || '' : ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="activityType">Type</label>
                    <select id="activityType" class="form-select">
                        <option value="sightseeing" ${existingActivity && existingActivity.type === 'sightseeing' ? 'selected' : ''}>🏛️ Sightseeing</option>
                        <option value="adventure" ${existingActivity && existingActivity.type === 'adventure' ? 'selected' : ''}>🏔️ Adventure</option>
                        <option value="cultural" ${existingActivity && existingActivity.type === 'cultural' ? 'selected' : ''}>🎭 Cultural</option>
                        <option value="shopping" ${existingActivity && existingActivity.type === 'shopping' ? 'selected' : ''}>🛍️ Shopping</option>
                        <option value="other" ${existingActivity && existingActivity.type === 'other' ? 'selected' : ''}>📌 Other</option>
                    </select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label" for="activityExpectedCost">Expected Cost (₹)</label>
                        <input type="number" id="activityExpectedCost" class="form-input" placeholder="0" min="0" step="1" value="${existingActivity ? existingActivity.expectedCost || '' : ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="activityActualCost">Actual Cost (₹)</label>
                        <input type="number" id="activityActualCost" class="form-input" placeholder="0" min="0" step="1" value="${existingActivity ? existingActivity.actualCost || '' : ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="activityNotes">Notes (optional)</label>
                    <textarea id="activityNotes" class="form-textarea" placeholder="Any special details...">${existingActivity ? existingActivity.notes || '' : ''}</textarea>
                </div>
                <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem;">
                    <button type="button" id="cancelActivityBtn" class="btn btn-secondary">Cancel</button>
                    <button type="submit" class="btn btn-primary">${existingActivity ? 'Update' : 'Add'} Activity</button>
                </div>
            </form>
        `;

        UIComponents.showModal(content);

        document.getElementById('cancelActivityBtn').onclick = () => {
            UIComponents.closeModal();
        };

        document.getElementById('activityForm').onsubmit = (e) => {
            e.preventDefault();

            const activityData = {
                id: existingActivity ? existingActivity.id : this.generateId(),
                name: document.getElementById('activityName').value.trim(),
                type: document.getElementById('activityType').value,
                expectedCost: parseFloat(document.getElementById('activityExpectedCost').value) || 0,
                // THIS FIXES THE ISSUE:
                actualCost: parseFloat(document.getElementById('activityActualCost').value) || 0,
                notes: document.getElementById('activityNotes').value.trim()
            };

            // Find day and add/update activity
            if (day) {
                if (!day.activities) day.activities = [];

                if (existingActivity) {
                    // Update
                    const index = day.activities.findIndex(a => a.id === existingActivity.id);
                    if (index !== -1) {
                        day.activities[index] = activityData;
                    }
                } else {
                    // Add
                    day.activities.push(activityData);
                }

                // Reconcile unified expenses
                this.reconcileDayExpenses(day);

                Storage.saveTrip(this.currentTrip);

                // Re-render
                this.renderDays();
                this.updateTripStats(); // Reactive Update

                UIComponents.closeModal();
                UIComponents.showToast(`Activity ${existingActivity ? 'updated' : 'added'}!`, 'success');
            }
        };
    },

    /**
     * Delete activity
     */
    deleteActivity(dayId, activityId) {
        if (!confirm('Are you sure you want to delete this activity?')) return;

        const day = this.currentTrip.days.find(d => d.id === dayId);
        if (day && day.activities) {
            const index = day.activities.findIndex(a => a.id === activityId);
            if (index !== -1) {
                const activity = day.activities[index];

                // Remove from activities list
                day.activities.splice(index, 1);

                // Delete from Firestore so other devices don't re-add it
                if (typeof SyncServiceEnhanced !== 'undefined' && SyncServiceEnhanced.canSync()) {
                    SyncServiceEnhanced.deleteFromCloud('activities', activityId);
                }

                // Reconcile unified expenses (handles cleanup)
                this.reconcileDayExpenses(day);

                Storage.saveTrip(this.currentTrip);
                this.renderDays();
                this.updateTripStats();

                UIComponents.showToast('Activity deleted', 'info');
            }
        }
    },

    /**
     * Show add/edit meal dialog
     */
    showAddMealDialog(dayId, mealId = null) {
        const day = this.currentTrip.days.find(d => d.id === dayId);
        if (!day) return;

        let existingMeal = null;
        if (mealId && day.meals) {
            existingMeal = day.meals.find(m => m.id === mealId);
        }

        // Carry-forward defaults from previous day (only for new meals)
        let defaultExpectedCost = '';
        let defaultVenue = 'restaurant';
        let defaultSplitCount = this.currentTrip.numberOfTravelers || 1;
        if (!existingMeal) {
            const prevDay = this.getPreviousDay(day);
            if (prevDay && prevDay.meals && prevDay.meals.length > 0) {
                // Try to find the same meal type from previous day
                const prevMeal = prevDay.meals[0]; // Use first meal as default
                if (prevMeal) {
                    defaultExpectedCost = prevMeal.expectedCost || '';
                    defaultVenue = prevMeal.venue || 'restaurant';
                    defaultSplitCount = prevMeal.splitCount || this.currentTrip.numberOfTravelers || 1;
                }
            }
        }

        const content = `
            <h3 style="margin-bottom: 1rem;">${existingMeal ? 'Edit Meal' : 'Add Meal'}</h3>
            <form id="mealForm">
                <div class="form-group">
                    <label class="form-label" for="mealType">Meal Type</label>
                    <select id="mealType" class="form-select" required>
                        <option value="breakfast" ${existingMeal && existingMeal.type === 'breakfast' ? 'selected' : ''}>🍳 Breakfast</option>
                        <option value="lunch" ${existingMeal && existingMeal.type === 'lunch' ? 'selected' : ''}>🍱 Lunch</option>
                        <option value="dinner" ${existingMeal && existingMeal.type === 'dinner' ? 'selected' : ''}>🍽️ Dinner</option>
                        <option value="snacks" ${existingMeal && existingMeal.type === 'snacks' ? 'selected' : ''}>🍿 Snacks</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="mealVenue">Where?</label>
                    <select id="mealVenue" class="form-select" required>
                        <option value="restaurant" ${existingMeal ? (existingMeal.venue === 'restaurant' ? 'selected' : '') : (defaultVenue === 'restaurant' ? 'selected' : '')}>🍴 Restaurant</option>
                        <option value="hotel" ${existingMeal ? (existingMeal.venue === 'hotel' ? 'selected' : '') : (defaultVenue === 'hotel' ? 'selected' : '')}>🏨 Hotel</option>
                        <option value="self-cooked" ${existingMeal ? (existingMeal.venue === 'self-cooked' ? 'selected' : '') : (defaultVenue === 'self-cooked' ? 'selected' : '')}>👨‍🍳 Self-cooked</option>
                        <option value="street-food" ${existingMeal ? (existingMeal.venue === 'street-food' ? 'selected' : '') : (defaultVenue === 'street-food' ? 'selected' : '')}>🌮 Street Food</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="restaurantName">Restaurant/Place Name (optional)</label>
                    <input type="text" id="restaurantName" class="form-input" placeholder="e.g., Taj Restaurant" value="${existingMeal ? existingMeal.restaurantName || '' : ''}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="mealSplitCount">Split between how many people?</label>
                    <input type="number" id="mealSplitCount" class="form-input" placeholder="Number of people" min="1" step="1" value="${existingMeal ? existingMeal.splitCount || this.currentTrip.numberOfTravelers || 1 : defaultSplitCount}" required>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label" for="mealExpectedCost">Expected Cost (₹)</label>
                        <input type="number" id="mealExpectedCost" class="form-input" placeholder="0" min="0" step="1" value="${existingMeal ? existingMeal.expectedCost || '' : defaultExpectedCost}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="mealActualCost">Actual Cost (₹)</label>
                        <input type="number" id="mealActualCost" class="form-input" placeholder="0" min="0" step="1" value="${existingMeal ? existingMeal.actualCost || '' : ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="mealNotes">Notes (optional)</label>
                    <textarea id="mealNotes" class="form-textarea" placeholder="Any special details...">${existingMeal ? existingMeal.notes || '' : ''}</textarea>
                </div>
                <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem;">
                    <button type="button" id="cancelMealBtn" class="btn btn-secondary">Cancel</button>
                    <button type="submit" class="btn btn-primary">${existingMeal ? 'Update' : 'Add'} Meal</button>
                </div>
            </form>
        `;

        UIComponents.showModal(content);

        document.getElementById('cancelMealBtn').onclick = () => {
            UIComponents.closeModal();
        };

        document.getElementById('mealForm').onsubmit = (e) => {
            e.preventDefault();

            const mealData = {
                id: existingMeal ? existingMeal.id : this.generateId(),
                type: document.getElementById('mealType').value,
                venue: document.getElementById('mealVenue').value,
                restaurantName: document.getElementById('restaurantName').value.trim(),
                splitCount: parseInt(document.getElementById('mealSplitCount').value) || 1,
                expectedCost: parseFloat(document.getElementById('mealExpectedCost').value) || 0,
                actualCost: parseFloat(document.getElementById('mealActualCost').value) || 0,
                notes: document.getElementById('mealNotes').value.trim()
            };

            if (day) {
                if (!day.meals) day.meals = [];

                if (existingMeal) {
                    // Update existing
                    const index = day.meals.findIndex(m => m.id === existingMeal.id);
                    if (index !== -1) {
                        day.meals[index] = mealData;
                    }
                } else {
                    // Add new
                    day.meals.push(mealData);
                }

                // Reconcile unified expenses
                this.reconcileDayExpenses(day);

                Storage.saveTrip(this.currentTrip);
                this.renderDays();
                this.updateTripStats();

                UIComponents.closeModal();
                UIComponents.showToast(`Meal ${existingMeal ? 'updated' : 'added'}!`, 'success');
            }
        };
    },

    /**
     * Delete meal
     */
    deleteMeal(dayId, mealId) {
        if (!confirm('Are you sure you want to delete this meal?')) return;

        const day = this.currentTrip.days.find(d => d.id === dayId);
        if (day && day.meals) {
            const index = day.meals.findIndex(m => m.id === mealId);
            if (index !== -1) {
                day.meals.splice(index, 1);

                // Delete from Firestore so other devices don't re-add it
                if (typeof SyncServiceEnhanced !== 'undefined' && SyncServiceEnhanced.canSync()) {
                    SyncServiceEnhanced.deleteFromCloud('meals', mealId);
                }

                // Reconcile unified expenses
                this.reconcileDayExpenses(day);

                Storage.saveTrip(this.currentTrip);
                this.renderDays();
                this.updateTripStats();

                UIComponents.showToast('Meal deleted', 'info');
            }
        }
    },

    /**
     * Show add/edit travel form
     */
    showTravelForm(dayId, existingTravel = null) {
        const day = this.currentTrip.days.find(d => d.id === dayId);
        if (!day) return;

        // Carry-forward defaults from previous day
        let defaultSplitCount = this.currentTrip.numberOfTravelers || 1;
        if (!existingTravel) {
            const prevDay = this.getPreviousDay(day);
            if (prevDay && prevDay.travel && prevDay.travel.length > 0) {
                const prevTravel = prevDay.travel[0];
                if (prevTravel) {
                    defaultSplitCount = prevTravel.splitBetween || this.currentTrip.numberOfTravelers || 1;
                }
            }
        }

        const content = `
            <h3 style="margin-bottom: 1rem;">${existingTravel ? 'Edit Travel' : 'Add Travel'}</h3>
            <form id="travelForm">
                <div class="form-group">
                    <label class="form-label" for="travelType">Travel Type</label>
                    <select id="travelType" class="form-select" required>
                        <option value="Auto" ${existingTravel && existingTravel.type === 'Auto' ? 'selected' : ''}>🛺 Auto</option>
                        <option value="Metro" ${existingTravel && existingTravel.type === 'Metro' ? 'selected' : ''}>🚇 Metro</option>
                        <option value="Bus" ${existingTravel && existingTravel.type === 'Bus' ? 'selected' : ''}>🚌 Bus</option>
                        <option value="Cab" ${existingTravel && existingTravel.type === 'Cab' ? 'selected' : ''}>🚕 Cab</option>
                        <option value="Train" ${existingTravel && existingTravel.type === 'Train' ? 'selected' : ''}>🚂 Train</option>
                        <option value="Flight" ${existingTravel && existingTravel.type === 'Flight' ? 'selected' : ''}>✈️ Flight</option>
                        <option value="Toll" ${existingTravel && existingTravel.type === 'Toll' ? 'selected' : ''}>🛣️ Toll</option>
                        <option value="Parking" ${existingTravel && existingTravel.type === 'Parking' ? 'selected' : ''}>🅿️ Parking</option>
                        <option value="Fuel" ${existingTravel && existingTravel.type === 'Fuel' ? 'selected' : ''}>⛽ Fuel</option>
                        <option value="Other" ${existingTravel && existingTravel.type === 'Other' ? 'selected' : ''}>🚗 Other</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label" for="travelFrom">From</label>
                    <input type="text" id="travelFrom" class="form-input" value="${existingTravel ? existingTravel.from : ''}" required placeholder="Starting location">
                </div>

                <div class="form-group">
                    <label class="form-label" for="travelTo">To</label>
                    <input type="text" id="travelTo" class="form-input" value="${existingTravel ? existingTravel.to : ''}" required placeholder="Destination">
                </div>

                <div class="form-group">
                    <label class="form-label" for="travelTime">Time (optional)</label>
                    <input type="time" id="travelTime" class="form-input" value="${existingTravel ? existingTravel.time || '' : ''}">
                </div>

                <div class="form-group">
                    <label class="form-label" for="travelExpectedCost">Expected Cost (₹)</label>
                    <input type="number" id="travelExpectedCost" class="form-input" value="${existingTravel ? existingTravel.expectedCost : ''}" required min="0" step="0.01">
                </div>

                <div class="form-group">
                    <label class="form-label" for="travelActualCost">Actual Cost (₹)</label>
                    <input type="number" id="travelActualCost" class="form-input" value="${existingTravel ? existingTravel.actualCost || '' : ''}" min="0" step="0.01">
                </div>

                <div class="form-group">
                    <label class="form-label" for="travelSplit">Split Between (people)</label>
                    <input type="number" id="travelSplit" class="form-input" value="${existingTravel ? existingTravel.splitBetween : defaultSplitCount}" required min="1">
                </div>

                <div class="form-group">
                    <label class="form-label" for="travelNotes">Notes (optional)</label>
                    <textarea id="travelNotes" class="form-input" rows="3" placeholder="Additional notes...">${existingTravel ? existingTravel.notes || '' : ''}</textarea>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="UIComponents.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save</button>
                </div>
            </form>
        `;

        UIComponents.showModal(content);

        // Form submit handler
        document.getElementById('travelForm').onsubmit = (e) => {
            e.preventDefault();

            const travelData = {
                id: existingTravel ? existingTravel.id : this.generateId(),
                dayId: dayId,
                type: document.getElementById('travelType').value,
                from: document.getElementById('travelFrom').value.trim(),
                to: document.getElementById('travelTo').value.trim(),
                time: document.getElementById('travelTime').value || null,
                expectedCost: parseFloat(document.getElementById('travelExpectedCost').value) || 0,
                actualCost: parseFloat(document.getElementById('travelActualCost').value) || 0,
                splitBetween: parseInt(document.getElementById('travelSplit').value) || 1,
                notes: document.getElementById('travelNotes').value.trim()
            };

            if (existingTravel) {
                // Update existing travel
                const index = day.travel.findIndex(t => t.id === existingTravel.id);
                if (index !== -1) {
                    day.travel[index] = travelData;
                }
            } else {
                // Add new travel
                if (!day.travel) {
                    day.travel = [];
                }
                day.travel.push(travelData);
            }

            // Reconcile unified expenses
            this.reconcileDayExpenses(day);

            Storage.saveTrip(this.currentTrip);
            this.renderDays();
            this.updateTripStats();

            UIComponents.closeModal();
            UIComponents.showToast(existingTravel ? 'Travel updated' : 'Travel added', 'success');
        };
    },

    /**
     * Delete travel
     */
    deleteTravel(dayId, travelId) {
        if (!confirm('Are you sure you want to delete this travel entry?')) return;

        const day = this.currentTrip.days.find(d => d.id === dayId);
        if (day && day.travel) {
            const index = day.travel.findIndex(t => t.id === travelId);
            if (index !== -1) {
                day.travel.splice(index, 1);

                // Delete from Firestore so other devices don't re-add it
                if (typeof SyncServiceEnhanced !== 'undefined' && SyncServiceEnhanced.canSync()) {
                    SyncServiceEnhanced.deleteFromCloud('travel', travelId);
                }

                // Reconcile unified expenses
                this.reconcileDayExpenses(day);

                Storage.saveTrip(this.currentTrip);
                this.renderDays();
                this.updateTripStats();

                UIComponents.showToast('Travel deleted', 'info');
            }
        }
    },

    /**
     * Show add accommodation dialog
     */
    showAddAccommodationDialog(dayId) {
        const day = this.currentTrip.days.find(d => d.id === dayId);
        if (!day) return;

        const currentAccommodation = day.accommodation || {};

        // Find previous day for "Copy" feature
        const dayIndex = this.currentTrip.days.findIndex(d => d.id === dayId);
        const previousDay = dayIndex > 0 ? this.currentTrip.days[dayIndex - 1] : null;
        const canCopy = previousDay && previousDay.accommodation && previousDay.accommodation.name;

        const content = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <h3 style="margin: 0;">${currentAccommodation.name ? 'Update' : 'Add'} Stay Details</h3>
                    <p style="color: var(--color-text-secondary); font-size: 0.875rem; margin-top: 0.25rem;">
                        Day ${day.dayNumber} - ${UIComponents.formatDate(day.date)}
                    </p>
                </div>
                ${canCopy ? `
                    <button id="copyPrevStayBtn" type="button" class="btn btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.75rem;">
                        📋 Same as Day ${previousDay.dayNumber}
                    </button>
                ` : ''}
            </div>

            <form id="accommodationForm">
                <div class="form-group">
                    <label class="form-label" for="accommodationName">Stay Name</label>
                    <input type="text" id="accommodationName" class="form-input" 
                        value="${currentAccommodation.name || ''}" 
                        placeholder="e.g., Grand Palace Hotel" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="accommodationType">Type</label>
                    <select id="accommodationType" class="form-select">
                        <option value="Hotel" ${currentAccommodation.type === 'Hotel' ? 'selected' : ''}>Hotel</option>
                        <option value="Hostel" ${currentAccommodation.type === 'Hostel' ? 'selected' : ''}>Hostel</option>
                        <option value="Resort" ${currentAccommodation.type === 'Resort' ? 'selected' : ''}>Resort</option>
                        <option value="Homestay" ${currentAccommodation.type === 'Homestay' ? 'selected' : ''}>Homestay</option>
                        <option value="Camp" ${currentAccommodation.type === 'Camp' ? 'selected' : ''}>Camp</option>
                        <option value="Other" ${currentAccommodation.type === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label" for="accExpectedCost">Expected Cost (₹)</label>
                        <input type="number" id="accExpectedCost" class="form-input" 
                            value="${currentAccommodation.expectedCost || ''}" 
                            placeholder="0" min="0" step="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="accActualCost">Actual Cost (₹)</label>
                        <input type="number" id="accActualCost" class="form-input" 
                            value="${currentAccommodation.actualCost || ''}" 
                            placeholder="0" min="0" step="1">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="accNotes">Notes (optional)</label>
                    <textarea id="accNotes" class="form-textarea" placeholder="Booking details, address...">${currentAccommodation.notes || ''}</textarea>
                </div>
                <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem;">
                    <button type="button" id="cancelAccBtn" class="btn btn-secondary">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Details</button>
                </div>
            </form>
        `;

        UIComponents.showModal(content);

        // Copy Handler
        if (canCopy) {
            document.getElementById('copyPrevStayBtn').onclick = () => {
                document.getElementById('accommodationName').value = previousDay.accommodation.name || '';
                document.getElementById('accommodationType').value = previousDay.accommodation.type || 'Hotel';
                document.getElementById('accExpectedCost').value = previousDay.accommodation.expectedCost || '';
                document.getElementById('accActualCost').value = previousDay.accommodation.actualCost || '';
                document.getElementById('accNotes').value = previousDay.accommodation.notes || '';

                UIComponents.showToast('Copied from Day ' + previousDay.dayNumber, 'success');
            };
        }

        // Cancel button
        document.getElementById('cancelAccBtn').onclick = () => {
            UIComponents.closeModal();
        };

        // Save
        document.getElementById('accommodationForm').onsubmit = (e) => {
            e.preventDefault();

            const accommodation = {
                id: currentAccommodation.id || this.generateId(),
                name: document.getElementById('accommodationName').value.trim(),
                type: document.getElementById('accommodationType').value,
                expectedCost: parseFloat(document.getElementById('accExpectedCost').value) || 0,
                actualCost: parseFloat(document.getElementById('accActualCost').value) || 0,
                notes: document.getElementById('accNotes').value.trim()
            };

            day.accommodation = accommodation;

            // Reconcile unified expenses
            this.reconcileDayExpenses(day);

            Storage.saveTrip(this.currentTrip);

            // Re-render
            this.renderDays();
            this.updateTripStats();

            UIComponents.closeModal();
            UIComponents.showToast('Stay details saved!', 'success');
        };
    },

    /**
     * Delete accommodation
     */
    deleteAccommodation(dayId) {
        if (!confirm('Are you sure you want to remove this stay?')) return;

        const day = this.currentTrip.days.find(d => d.id === dayId);
        if (day) {
            // Capture ID before deleting locally
            const accId = day.accommodation ? day.accommodation.id : null;
            delete day.accommodation;

            // Delete from Firestore so other devices don't re-add it
            if (accId && typeof SyncServiceEnhanced !== 'undefined' && SyncServiceEnhanced.canSync()) {
                SyncServiceEnhanced.deleteFromCloud('accommodations', accId);
            }

            // Reconcile unified expenses
            this.reconcileDayExpenses(day);

            Storage.saveTrip(this.currentTrip);
            this.renderDays();
            this.updateTripStats();

            UIComponents.showToast('Stay removed', 'info');
        }
    },

    /**
     * Show add fuel purchase dialog
     */
    showAddFuelDialog() {
        const content = `
            <h3 style="margin-bottom: 1rem;">Add Fuel Purchase</h3>
            <form id="fuelForm">
                <div class="form-group">
                    <label class="form-label" for="fuelLocation">Location</label>
                    <input type="text" id="fuelLocation" class="form-input" placeholder="e.g., HP Petrol Pump, Mumbai" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="fuelPrice">Price per Liter (₹)</label>
                    <input type="number" id="fuelPrice" class="form-input" placeholder="e.g., 105.50" min="0" step="0.01" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="fuelQuantity">Quantity (Liters) - Optional</label>
                    <input type="number" id="fuelQuantity" class="form-input" placeholder="e.g., 30" min="0" step="0.01">
                    <p class="form-hint">Leave blank if you don't want to track quantity</p>
                </div>
                <div class="form-group">
                    <label class="form-label" for="fuelTotal">Total Cost (₹)</label>
                    <input type="number" id="fuelTotal" class="form-input" placeholder="0" min="0" step="1" required>
                </div>
                <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem;">
                    <button type="button" id="cancelFuelBtn" class="btn btn-secondary">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Fuel</button>
                </div>
            </form>
        `;

        UIComponents.showModal(content);

        // Auto-calculate total when price and quantity change
        const priceInput = document.getElementById('fuelPrice');
        const quantityInput = document.getElementById('fuelQuantity');
        const totalInput = document.getElementById('fuelTotal');

        const calculateTotal = () => {
            const price = parseFloat(priceInput.value) || 0;
            const quantity = parseFloat(quantityInput.value) || 0;
            if (price > 0 && quantity > 0) {
                totalInput.value = (price * quantity).toFixed(2);
            }
        };

        priceInput.oninput = calculateTotal;
        quantityInput.oninput = calculateTotal;

        document.getElementById('cancelFuelBtn').onclick = () => {
            UIComponents.closeModal();
        };

        document.getElementById('fuelForm').onsubmit = (e) => {
            e.preventDefault();

            const purchase = {
                id: this.generateId(),
                location: document.getElementById('fuelLocation').value.trim(),
                pricePerLiter: parseFloat(document.getElementById('fuelPrice').value),
                quantity: parseFloat(document.getElementById('fuelQuantity').value) || null,
                totalCost: parseFloat(document.getElementById('fuelTotal').value),
                date: new Date().toISOString()
            };

            if (!this.currentTrip.vehicle) {
                this.currentTrip.vehicle = { type: 'car', odometerStart: null, odometerEnd: null, fuelPurchases: [] };
            }
            if (!this.currentTrip.vehicle.fuelPurchases) {
                this.currentTrip.vehicle.fuelPurchases = [];
            }

            this.currentTrip.vehicle.fuelPurchases.push(purchase);

            Storage.saveTrip(this.currentTrip);
            this.renderTripDetail();

            UIComponents.closeModal();
            UIComponents.showToast('Fuel purchase added!', 'success');
        };
    },

    /**
     * Show update odometer & fuel dialog
     */
    showUpdateOdometerDialog(dayId) {
        const day = this.currentTrip.days.find(d => d.id === dayId);
        const autoStartOdometer = this.getAutoStartOdometer(day);
        const prevDay = this.getPreviousDay(day);

        const dayIndex = this.currentTrip.days.findIndex(d => d.id === dayId);
        const isFirstDay = dayIndex === 0;

        const content = `
            <h3 style="margin-bottom: 0.5rem;">Update Transport Details</h3>
            <p style="color: var(--color-text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem;">
                Day ${day.dayNumber} - ${UIComponents.formatDate(day.date)}
            </p>
            <form id="odometerForm">
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input type="checkbox" id="noDrivingToday" ${day.noDrivingToday ? 'checked' : ''} 
                            style="width: 1.25rem; height: 1.25rem; cursor: pointer;">
                        <span style="font-weight: 600;">🅿️ No Driving Today</span>
                    </label>
                    <p style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem; margin-left: 1.75rem;">
                        Check this if the vehicle wasn't used today
                    </p>
                </div>
                
                <div id="odometerFields">
                    <div class="form-group">
                        <label class="form-label" for="startOdometer">Start Odometer (km)</label>
                        <input type="number" id="startOdometer" class="form-input" 
                            value="${day.startOdometer || autoStartOdometer}" 
                            min="0" step="1" required>
                        <p style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem;">
                            ${prevDay ? `Auto-filled from Day ${prevDay.dayNumber} end reading` : 'From trip starting odometer'}
                        </p>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="endOdometer">End Odometer (km)</label>
                        <input type="number" id="endOdometer" class="form-input" 
                            value="${day.endOdometer || ''}" 
                            min="${autoStartOdometer}" step="1" required>
                    </div>
                    <div id="distanceDisplay" style="padding: 0.75rem; background: var(--color-bg-secondary); border-radius: 6px; margin-bottom: 1rem; text-align: center;">
                        <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">Distance</div>
                        <div style="font-weight: 700; font-size: 1.25rem; color: var(--color-primary);">-- km</div>
                    </div>
                    
                    <div style="border-top: 1px solid var(--color-border); padding-top: 1rem; margin-top: 1rem;">
                        <h4 style="font-size: 0.875rem; margin-bottom: 1rem; color: var(--color-text-secondary);">Fuel (Optional)</h4>
                        
                        <div class="form-group">
                            <label class="form-label" for="fuelFilled">Fuel Filled (liters)</label>
                            <input type="number" id="fuelFilled" class="form-input" 
                                value="${day.fuelFilled || ''}" 
                                min="0" step="0.1" placeholder="e.g., 25.5">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="expectedFuelCost">Expected Fuel Cost (₹)</label>
                            <input type="number" id="expectedFuelCost" class="form-input" 
                                value="${day.expectedFuelCost || ''}" 
                                min="0" step="1" placeholder="e.g., 2300">
                            <p style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem;" id="fuelEstimate">
                                ${this.currentTrip.mileage ? 'Will calculate based on distance...' : ''}
                            </p>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="fuelCost">Actual Fuel Cost (₹)</label>
                            <input type="number" id="fuelCost" class="form-input" 
                                value="${day.fuelCost || ''}" 
                                min="0" step="1" placeholder="e.g., 2500">
                        </div>
                        <div id="efficiencyDisplay" style="padding: 0.75rem; background: var(--color-bg-secondary); border-radius: 6px; text-align: center;">
                            <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">Efficiency</div>
                            <div style="font-weight: 700; font-size: 1.25rem; color: var(--color-secondary);">-- km/l</div>
                        </div>
                        <div id="costComparisonDisplay" style="margin-top: 0.75rem;"></div>
                    </div>
                </div>
                
                <div class="form-group" style="margin-top: 1rem;">
                    <label class="form-label" for="transportNotes">Notes (Optional)</label>
                    <textarea id="transportNotes" class="form-input" rows="3" 
                        placeholder="e.g., Stopped at scenic viewpoint, Heavy traffic...">${day.transportNotes || ''}</textarea>
                </div>
                
                <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
                    <button type="button" id="cancelBtn" class="btn btn-secondary" style="flex: 1;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="flex: 2;">Save</button>
                </div>
            </form>
        `;

        UIComponents.showModal(content);

        // Set up no driving toggle
        const noDrivingCheckbox = document.getElementById('noDrivingToday');
        const odometerFields = document.getElementById('odometerFields');
        const startInput = document.getElementById('startOdometer');
        const endInput = document.getElementById('endOdometer');
        const fuelInput = document.getElementById('fuelFilled');
        const distanceDisplay = document.getElementById('distanceDisplay');
        const efficiencyDisplay = document.getElementById('efficiencyDisplay');

        const toggleOdometerFields = () => {
            if (noDrivingCheckbox.checked) {
                odometerFields.style.display = 'none';
                startInput.required = false;
                endInput.required = false;
            } else {
                odometerFields.style.display = 'block';
                startInput.required = true;
                endInput.required = true;
            }
        };

        noDrivingCheckbox.onchange = toggleOdometerFields;
        toggleOdometerFields(); // Initial state

        const updateCalculations = () => {
            const start = parseFloat(startInput.value) || 0;
            const end = parseFloat(endInput.value) || 0;
            const fuel = parseFloat(fuelInput.value) || 0;
            const expectedCost = parseFloat(document.getElementById('expectedFuelCost').value) || 0;
            const actualCost = parseFloat(document.getElementById('fuelCost').value) || 0;

            const distance = end - start;
            const efficiency = fuel > 0 && distance > 0 ? (distance / fuel).toFixed(1) : null;

            // Calculate expected fuel based on distance and trip mileage
            const expectedFuel = this.currentTrip.mileage && distance > 0
                ? (distance / this.currentTrip.mileage).toFixed(1)
                : null;

            // Update fuel estimate message
            const fuelEstimate = document.getElementById('fuelEstimate');
            if (fuelEstimate && expectedFuel) {
                fuelEstimate.innerHTML = `Estimated: ~${expectedFuel} L needed for ${distance} km`;
                fuelEstimate.style.color = 'var(--color-primary)';
            }

            distanceDisplay.innerHTML = `
                <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">Distance</div>
                <div style="font-weight: 700; font-size: 1.25rem; color: var(--color-primary);">${distance > 0 ? distance : '--'} km</div>
            `;

            efficiencyDisplay.innerHTML = `
                <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">Efficiency</div>
                <div style="font-weight: 700; font-size: 1.25rem; color: var(--color-secondary);">${efficiency || '--'} km/l</div>
                ${efficiency && this.currentTrip.mileage ? `
                    <div style="font-size: 0.75rem; margin-top: 0.5rem;">
                        Expected: ${this.currentTrip.mileage} km/l 
                        ${efficiency >= this.currentTrip.mileage ? '✅' : '⚠️'}
                    </div>
                ` : ''}
            `;

            // Show cost comparison if both expected and actual are present
            const costComparisonDisplay = document.getElementById('costComparisonDisplay');
            if (expectedCost > 0 && actualCost > 0) {
                const difference = actualCost - expectedCost;
                const percentDiff = ((difference / expectedCost) * 100).toFixed(1);
                const isOver = difference > 0;

                costComparisonDisplay.innerHTML = `
                    <div style="padding: 0.75rem; background: ${isOver ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)'}; border-radius: 6px; border-left: 3px solid ${isOver ? '#ef4444' : '#22c55e'};">
                        <div style="font-size: 0.75rem; font-weight: 600; margin-bottom: 0.25rem; color: ${isOver ? '#ef4444' : '#22c55e'};">
                            ${isOver ? '⚠️ Over Budget' : '✅ Under Budget'}
                        </div>
                        <div style="font-size: 0.875rem;">
                            Expected: ${UIComponents.formatCurrency(expectedCost)} → 
                            Actual: ${UIComponents.formatCurrency(actualCost)}
                        </div>
                        <div style="font-size: 0.75rem; margin-top: 0.25rem; font-weight: 600;">
                            ${isOver ? '+' : ''}${UIComponents.formatCurrency(difference)} (${isOver ? '+' : ''}${percentDiff}%)
                        </div>
                    </div>
                `;
            } else {
                costComparisonDisplay.innerHTML = '';
            }
        };

        startInput.oninput = updateCalculations;
        endInput.oninput = updateCalculations;
        fuelInput.oninput = updateCalculations;
        document.getElementById('expectedFuelCost').oninput = updateCalculations;
        document.getElementById('fuelCost').oninput = updateCalculations;

        // Initial calculation
        if (!day.noDrivingToday) {
            updateCalculations();
        }

        // Set up form submission
        document.getElementById('odometerForm').onsubmit = (e) => {
            e.preventDefault();

            day.noDrivingToday = noDrivingCheckbox.checked;
            day.transportNotes = document.getElementById('transportNotes').value.trim();

            if (!day.noDrivingToday) {
                const start = parseFloat(startInput.value);
                const end = parseFloat(endInput.value);

                // Validate endOdometer >= startOdometer
                if (end < start) {
                    UIComponents.showToast('End odometer must be greater than or equal to start odometer', 'error', 3000);
                    return;
                }

                day.startOdometer = start;
                day.endOdometer = end;
                day.fuelFilled = parseFloat(fuelInput.value) || null;
                day.expectedFuelCost = parseFloat(document.getElementById('expectedFuelCost').value) || null;
                day.fuelCost = parseFloat(document.getElementById('fuelCost').value) || null;

                // Auto-create or update fuel expense
                this.reconcileDayExpenses(day);
            } else {
                // Clear odometer data for no-driving days
                day.startOdometer = null;
                day.endOdometer = null;
                day.fuelFilled = null;
                day.fuelCost = null;

                if (!day.expenses) day.expenses = [];

                // Find existing fuel expense
                const existingIndex = day.expenses.findIndex(e =>
                    e._autoFuel === true || e.name === 'Fuel' || e.category === 'Fuel'
                );

                if (existingIndex !== -1) {
                    day.expenses.splice(existingIndex, 1);
                }
            }

            this.currentTrip.updatedAt = new Date().toISOString();
            Storage.saveTrip(this.currentTrip);

            UIComponents.closeModal();
            UIComponents.closeModal();
            this.renderDays();
            this.updateTripStats();
            UIComponents.showToast('Transport details updated!', 'success');
        };

        // Set up cancel button
        document.getElementById('cancelBtn').onclick = () => {
            UIComponents.closeModal();
        };
    },

    /**
     * Reconcile Day Expenses (Nuclear Rebuild)
     * Derived property: Expenses are calculated purely from Active Items (Activities, Meals, Stay, Fuel).
     * This eliminates legacy ghosts and ensures perfect tallying.
     */
    reconcileDayExpenses(day) {
        // RESET: Start with a clean slate
        const autoExpenses = [];

        // 1. Generate Activity Expenses
        if (day.activities) {
            day.activities.forEach(activity => {
                const cost = activity.actualCost || activity.actualExpense || 0;
                const expected = activity.expectedCost || activity.expectedExpense || 0;

                // Track if either cost exists
                if (cost > 0 || expected > 0) {
                    autoExpenses.push(new Expense({
                        name: activity.name,
                        category: 'Activity',
                        actualAmount: cost,
                        expectedAmount: expected,
                        splitCount: this.currentTrip.travelers || 1,
                        source: 'Activity',
                        linkedDayId: day.id,
                        linkedActivityId: activity.id
                    }));
                }
            });
        }

        // 2. Generate Meal Expenses (Grouped by Type)
        if (day.meals) {
            ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(type => {
                const mealsOfType = day.meals.filter(m => m.type === type);

                if (mealsOfType.length > 0) {
                    const totalActualCost = mealsOfType.reduce((sum, m) => sum + (m.actualCost || 0), 0);
                    const totalExpectedCost = mealsOfType.reduce((sum, m) => sum + (m.expectedCost || 0), 0);

                    // Use splitCount from the first meal of this type, or fall back to trip travelers
                    const splitCount = mealsOfType[0].splitCount || this.currentTrip.numberOfTravelers || 1;

                    if (totalActualCost > 0 || totalExpectedCost > 0) {
                        autoExpenses.push(new Expense({
                            name: type.charAt(0).toUpperCase() + type.slice(1),
                            category: 'Food',
                            actualAmount: totalActualCost,
                            expectedAmount: totalExpectedCost,
                            splitCount: splitCount,
                            source: 'Meal',
                            linkedDayId: day.id
                        }));
                    }
                }
            });
        }

        // 3. Generate Travel Expenses
        if (day.travel) {
            day.travel.forEach(travel => {
                const actualCost = travel.actualCost || 0;
                const expectedCost = travel.expectedCost || 0;
                const splitCount = travel.splitBetween || this.currentTrip.numberOfTravelers || 1;

                if (actualCost > 0 || expectedCost > 0) {
                    autoExpenses.push(new Expense({
                        name: `${travel.type}: ${travel.from} → ${travel.to}`,
                        category: 'Travel',
                        actualAmount: actualCost,
                        expectedAmount: expectedCost,
                        splitCount: splitCount,
                        source: 'Travel',
                        linkedDayId: day.id,
                        linkedTravelId: travel.id
                    }));
                }
            });
        }

        // 4. Generate Stay Expense
        if (day.accommodation && (day.accommodation.actualCost > 0 || day.accommodation.expectedCost > 0)) {
            autoExpenses.push(new Expense({
                name: day.accommodation.name || 'Accommodation',
                category: 'Stay',
                actualAmount: day.accommodation.actualCost || 0,
                expectedAmount: day.accommodation.expectedCost || 0,
                splitCount: this.currentTrip.travelers || 1,
                source: 'Accommodation',
                linkedDayId: day.id,
                notes: day.accommodation.type
            }));
        }

        // 4. Generate Fuel Expense
        if ((day.fuelCost && day.fuelCost > 0) || (day.expectedFuelCost && day.expectedFuelCost > 0)) {
            autoExpenses.push(new Expense({
                name: 'Fuel',
                category: 'Fuel',
                actualAmount: day.fuelCost || 0,
                expectedAmount: day.expectedFuelCost || 0,
                splitCount: this.currentTrip.travelers || 1,
                source: 'Fuel',
                linkedDayId: day.id,
                notes: day.fuelFilled ? `${day.fuelFilled} L` : ''
            }));
        }

        // 5. Finalize
        const serializedAuto = autoExpenses.map(e => e.toJSON ? e.toJSON() : e);
        // Replace entire list
        day.expenses = serializedAuto;
    },

    /**
     * Reconcile all days (Global Cleanup)
     */
    reconcileAllDays() {
        if (!this.currentTrip || !this.currentTrip.days) return;

        console.log('[Reconcile] Running global expense reconciliation...');
        this.currentTrip.days.forEach(day => {
            this.reconcileDayExpenses(day);
        });

        // Save cleaned state
        Storage.saveTrip(this.currentTrip);
    },

    /**
     * Calculate per-person cost
     */
    calculatePerPersonCost(totalAmount, splitCount) {
        return splitCount > 0 ? (totalAmount / splitCount) : 0;
    },

    /**
     * Calculate day total expenses
     */
    /**
     * Calculate day total expenses
     * RELIES 100% on day.expenses (Unified Source of Truth)
     */
    calculateDayTotal(day) {
        let expected = 0, actual = 0;

        // Sum ONLY from expenses list (which is now robustly reconciled)
        if (day.expenses) {
            day.expenses.forEach(expense => {
                expected += expense.expectedAmount || 0;
                actual += expense.actualAmount || 0;
            });
        }

        const variance = actual - expected;
        return { expected, actual, variance };
    },

    /**
     * Check if a day has incomplete actual expenses
     * A day is incomplete if it has at least one expense with actualAmount = 0 or missing
     */
    isDayIncomplete(day) {
        if (!day || !day.expenses || day.expenses.length === 0) {
            return false; // No expenses = not incomplete
        }

        // Check if any expense has zero or missing actualAmount
        return day.expenses.some(expense => {
            return !expense.actualAmount || expense.actualAmount === 0;
        });
    },

    /**
     * Update trip stats (header totals) reactive
     * Re-renders the Budget Overview card to reflect expense changes
     */
    updateTripStats() {
        const trip = this.currentTrip;
        const totalExpected = UIComponents.calculateTotalExpected(trip);
        const totalActual = UIComponents.calculateTotalActual(trip);
        const variance = totalActual - totalExpected;

        // Find and update the Budget Overview card
        const budgetCard = document.querySelector('.budget-overview-card');
        if (budgetCard) {
            // Calculate values
            const percentage = totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0;
            const isOverBudget = totalActual > totalExpected && totalExpected > 0;
            const difference = Math.abs(variance);

            // Re-render the Budget Overview content
            budgetCard.innerHTML = `
                <h3 style="margin: 0 0 2rem 0; font-size: 1.125rem; font-weight: 600; color: var(--color-text);">Budget Overview</h3>
                
                <!-- Section 1: Primary Budget Summary -->
                <div class="budget-primary-summary">
                    <div class="budget-expected-primary">
                        <div class="budget-label-primary">Total Budget</div>
                        <div class="budget-value-primary" style="color: #fbbf24; font-size: 2.25rem; font-weight: 700; margin-top: 0.5rem;">
                            ${UIComponents.formatCurrency(totalExpected)}
                        </div>
                    </div>
                    
                    <div class="budget-actual-primary" style="margin-top: 1.5rem;">
                        <div class="budget-label-primary">Spent</div>
                        <div class="budget-value-primary" style="color: ${isOverBudget ? '#f87171' : '#34d399'}; font-size: 2.25rem; font-weight: 700; margin-top: 0.5rem;">
                            ${totalActual > 0 ? UIComponents.formatCurrency(totalActual) : '-'}
                        </div>
                        ${totalActual > 0 && totalExpected > 0 ? `
                            <div class="budget-status-pill ${isOverBudget ? 'over-budget' : 'under-budget'}" style="
                                display: inline-block;
                                padding: 6px 14px;
                                border-radius: 999px;
                                font-size: 0.875rem;
                                font-weight: 600;
                                margin-top: 0.75rem;
                                background: ${isOverBudget ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'};
                                color: ${isOverBudget ? '#f87171' : '#34d399'};
                                border: 1px solid ${isOverBudget ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'};
                            ">
                                ${isOverBudget ? '₹' + UIComponents.formatCurrency(difference).replace('₹', '') + ' over budget' : '₹' + UIComponents.formatCurrency(difference).replace('₹', '') + ' under budget'}
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Progress Bar -->
                    ${totalExpected > 0 && totalActual > 0 ? `
                        <div class="budget-progress-bar" style="margin: 2rem 0 1.5rem 0;">
                            <div class="progress-track" style="
                                height: 10px;
                                background: rgba(255, 255, 255, 0.08);
                                border-radius: 999px;
                                overflow: hidden;
                                position: relative;
                            ">
                                <div class="progress-fill ${isOverBudget ? 'over-budget' : 'under-budget'}" style="
                                    height: 100%;
                                    width: ${Math.min(percentage, 100)}%;
                                    border-radius: 999px;
                                    background: ${isOverBudget ? 'linear-gradient(90deg, #ef4444, #dc2626)' : 'linear-gradient(90deg, #10b981, #059669)'};
                                    transition: width 200ms ease;
                                "></div>
                                ${percentage > 100 ? `
                                    <div style="
                                        position: absolute;
                                        top: 0;
                                        left: 0;
                                        right: 0;
                                        bottom: 0;
                                        background: linear-gradient(90deg, #ef4444, #dc2626);
                                        animation: pulse 2s ease-in-out infinite;
                                    "></div>
                                ` : ''}
                            </div>
                            <div style="
                                font-size: 0.75rem;
                                color: var(--color-text-secondary);
                                text-align: right;
                                margin-top: 0.5rem;
                            ">${percentage}% of budget</div>
                        </div>
                    ` : ''}
                </div>
                
                
                <!-- Section 3: Informational Message -->
                ${totalActual > 0 && totalExpected > 0 ? `
                    <div class="budget-info-message ${isOverBudget ? 'warning' : 'success'}" style="
                        padding: 1rem 1.5rem;
                        border-radius: 12px;
                        font-size: 0.9rem;
                        text-align: center;
                        margin-top: 1.5rem;
                        background: ${isOverBudget ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'};
                        color: ${isOverBudget ? '#fca5a5' : '#6ee7b7'};
                        border: 1px solid ${isOverBudget ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'};
                        box-shadow: 0 0 20px ${isOverBudget ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'};
                        font-weight: 500;
                    ">
                        ${isOverBudget
                        ? `⚠️ You overspent by ${UIComponents.formatCurrency(difference)} — ${percentage}% of budget exceeded`
                        : `✅ You saved ${UIComponents.formatCurrency(difference)} — only ${percentage}% of budget used`
                    }
                    </div>
                ` : ''}
            `;
        }
    },

    /**
     * Add a new day to the trip
     */
    addDayToTrip() {
        if (!this.currentTrip || !this.currentTrip.days) return;

        const days = this.currentTrip.days;
        const lastDay = days[days.length - 1];

        // Calculate new date
        const newDate = new Date(lastDay.date);
        newDate.setDate(newDate.getDate() + 1);

        // Create new ID
        const newDayId = 'day_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Initialize with complete structure matching generateDays
        const newDay = {
            id: newDayId,
            tripId: this.currentTrip.id,
            dayNumber: lastDay.dayNumber + 1,
            date: newDate.toISOString().split('T')[0],

            // Odometer tracking (for self-drive trips)
            startOdometer: null,
            endOdometer: null,

            // Fuel tracking
            fuelFilled: null,
            fuelCost: null,
            expectedFuelCost: null,

            // Transport
            transportNotes: '',
            noDrivingToday: false,

            // Accommodation
            accommodation: {
                type: 'hotel',
                name: '',
                expectedCost: 0,
                actualCost: 0,
                notes: ''
            },

            // Collections
            meals: [],
            activities: [],
            travel: [],
            expenses: [],

            // Transport override
            transportOverride: null,

            // Day notes
            dayNotes: ''
        };

        // Push and update trip
        this.currentTrip.days.push(newDay);
        this.currentTrip.endDate = newDate.toISOString();

        // Save and refresh
        Storage.saveTrip(this.currentTrip);
        this.renderTripDetail(this.currentTrip.id);

        UIComponents.showToast('Day added successfully', 'success');

        // Scroll to bottom
        setTimeout(() => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }, 100);
    },

    /**
     * Delete a day from the trip
     */
    confirmDeleteDay(dayId) {
        const day = this.currentTrip.days.find(d => d.id === dayId);
        if (!day) return;

        // Check if day has data
        const hasData = (day.meals && day.meals.length > 0) ||
            (day.activities && day.activities.length > 0) ||
            (day.travel && day.travel.length > 0) ||
            (day.accommodation) ||
            (day.expenses && day.expenses.length > 0);

        if (hasData) {
            UIComponents.showConfirm(
                'Delete Day ' + day.dayNumber,
                'This day includes planned items or expenses. Are you sure you want to delete it? This cannot be undone.',
                () => this.deleteDay(dayId)
            );
        } else {
            this.deleteDay(dayId);
        }
    },

    deleteDay(dayId) {
        const trip = this.currentTrip;
        const dayIndex = trip.days.findIndex(d => d.id === dayId);
        if (dayIndex === -1) return;

        // Cascade-delete day and all sub-entities from Firestore
        if (typeof SyncServiceEnhanced !== 'undefined' && SyncServiceEnhanced.canSync()) {
            SyncServiceEnhanced.deleteDayFromCloud(dayId, trip.id);
        }

        // Remove day
        trip.days.splice(dayIndex, 1);

        // Recalculate day numbers
        trip.days.forEach((day, index) => {
            day.dayNumber = index + 1;
        });

        // Update trip dates if needed (simplification: if last day deleted, adjust end date)
        if (trip.days.length > 0) {
            // Keep start date fixed per requirements "Do NOT change trip start date"
            // But we might want to update endDate to match the new last day
            const lastDay = trip.days[trip.days.length - 1];
            trip.endDate = lastDay.date;
        }

        // Save and refresh
        Storage.saveTrip(trip);
        this.renderTripDetail(trip.id);
        UIComponents.showToast('Day deleted', 'success');
    },

    /**
     * Calculate trip total expenses
     */
    calculateTripTotal(trip) {
        let expected = 0, actual = 0;

        if (trip.days) {
            trip.days.forEach(day => {
                const dayTotal = this.calculateDayTotal(day);
                expected += dayTotal.expected;
                actual += dayTotal.actual;
            });
        }

        return {
            expected,
            actual,
            variance: actual - expected
        };
    },

    /**
     * Calculate distance for a day (self-drive trips)
     */
    calculateDayDistance(day) {
        if (day.startOdometer !== null && day.endOdometer !== null) {
            return day.endOdometer - day.startOdometer;
        }
        return 0;
    },

    /**
     * Calculate total trip distance (self-drive trips)
     */
    calculateTotalDistance(trip) {
        if (!trip.isSelfDriveTrip || !trip.days) return 0;

        return trip.days.reduce((total, day) => {
            return total + this.calculateDayDistance(day);
        }, 0);
    },

    /**
     * Calculate total fuel cost (self-drive trips)
     */
    calculateTotalFuelCost(trip) {
        if (!trip.isSelfDriveTrip || !trip.days) return 0;

        return trip.days.reduce((total, day) => {
            return total + (day.fuelCost || 0);
        }, 0);
    },

    /**
     * Calculate total fuel filled (self-drive trips)
     */
    calculateTotalFuelFilled(trip) {
        if (!trip.isSelfDriveTrip || !trip.days) return 0;

        return trip.days.reduce((total, day) => {
            return total + (day.fuelFilled || 0);
        }, 0);
    },

    /**
     // Calculate actual fuel efficiency (self-drive trips)
    calculateActualFuelEfficiency(trip) {
        const totalDistance = this.calculateTotalDistance(trip);
        const totalFuel = this.calculateTotalFuelFilled(trip);
    
        if (totalDistance > 0 && totalFuel > 0) {
            return (totalDistance / totalFuel).toFixed(1);
        }
    
        return null;
    },
    
    /**
     * Get previous day
     */
    getPreviousDay(day) {
        if (!this.currentTrip || !this.currentTrip.days) return null;
        const dayIndex = this.currentTrip.days.findIndex(d => d.id === day.id);
        if (dayIndex <= 0) return null;
        return this.currentTrip.days[dayIndex - 1];
    },

    /**
     * Update day odometer auto-prefill
     */
    updateDayOdometerPrefill(dayIndex) {
        if (!this.currentTrip.isSelfDriveTrip || !this.currentTrip.days) return;

        // Update next day's start odometer from current day's end
        if (dayIndex < this.currentTrip.days.length - 1) {
            const currentDay = this.currentTrip.days[dayIndex];
            const nextDay = this.currentTrip.days[dayIndex + 1];

            if (currentDay.endOdometer !== null) {
                nextDay.startOdometer = currentDay.endOdometer;
            }
        }
    },

    /**
     * Copy accommodation from one day to another
     */
    copyAccommodationFromDay(fromDayIndex, toDayIndex) {
        if (!this.currentTrip.days) return;

        const fromDay = this.currentTrip.days[fromDayIndex];
        const toDay = this.currentTrip.days[toDayIndex];

        if (fromDay && toDay && fromDay.accommodation) {
            // Deep copy accommodation
            toDay.accommodation = {
                type: fromDay.accommodation.type,
                name: fromDay.accommodation.name,
                expectedCost: fromDay.accommodation.expectedCost,
                actualCost: 0, // Reset actual cost
                notes: fromDay.accommodation.notes
            };

            // Save changes
            Storage.saveTrip(this.currentTrip);
            UIComponents.showToast(`Accommodation copied from Day ${fromDayIndex + 1} `, 'success');
        }
    },

    /**
     * Copy food from one day to another
     */
    copyFoodFromDay(fromDayIndex, toDayIndex) {
        if (!this.currentTrip.days) return;

        const fromDay = this.currentTrip.days[fromDayIndex];
        const toDay = this.currentTrip.days[toDayIndex];

        if (fromDay && toDay && fromDay.food) {
            // Deep copy food
            toDay.food = {
                breakfast: {
                    expected: fromDay.food.breakfast.expected,
                    actual: 0,
                    venue: fromDay.food.breakfast.venue,
                    notes: fromDay.food.breakfast.notes
                },
                lunch: {
                    expected: fromDay.food.lunch.expected,
                    actual: 0,
                    venue: fromDay.food.lunch.venue,
                    notes: fromDay.food.lunch.notes
                },
                dinner: {
                    expected: fromDay.food.dinner.expected,
                    actual: 0,
                    venue: fromDay.food.dinner.venue,
                    notes: fromDay.food.dinner.notes
                }
            };

            // Save changes
            Storage.saveTrip(this.currentTrip);
            UIComponents.showToast(`Food plan copied from Day ${fromDayIndex + 1} `, 'success');
        }
    },

    /**
     * Check if similar expense exists
     */
    hasSimilarExpense(dayIndex, expenseName, category) {
        if (!this.currentTrip.days || !this.currentTrip.days[dayIndex]) return false;

        const day = this.currentTrip.days[dayIndex];
        if (!day.expenses) return false;

        return day.expenses.some(expense =>
            expense.expenseName.toLowerCase().trim() === expenseName.toLowerCase().trim() &&
            expense.category === category
        );
    },

    /**
     * Toggle transport override for a day
     */
    toggleTransportOverride(dayIndex, enabled, transportMode = null) {
        if (!this.currentTrip.days || !this.currentTrip.days[dayIndex]) return;

        const day = this.currentTrip.days[dayIndex];

        if (enabled && transportMode) {
            day.transportOverride = transportMode;
        } else {
            day.transportOverride = null;
        }

        // Save changes
        Storage.saveTrip(this.currentTrip);
    },

    /**
     * Get effective transport mode for a day
     */
    getEffectiveTransportMode(dayIndex) {
        if (!this.currentTrip.days || !this.currentTrip.days[dayIndex]) {
            return this.currentTrip.defaultTransportMode;
        }

        const day = this.currentTrip.days[dayIndex];
        return day.transportOverride || this.currentTrip.defaultTransportMode;
    },

    /**
     * Confirm delete trip
     */
    confirmDeleteTrip(tripId) {
        const trip = Storage.getTrip(tripId);
        if (!trip) return;

        UIComponents.showConfirm(
            'Delete Trip',
            `Are you sure you want to delete "${trip.tripName || trip.name}" ? This action cannot be undone.`,
            () => {
                this.deleteTrip(tripId);
            }
        );
    },

    /**
     * Delete a trip
     */
    deleteTrip(tripId) {
        Storage.deleteTrip(tripId);
        UIComponents.showToast('Trip deleted successfully', 'success');

        // Refresh the view
        const trips = Storage.getTrips();
        if (trips.length === 0) {
            this.showWelcomeScreen();
        } else {
            // If we're on the trip detail screen for the deleted trip, go back to list
            if (this.currentScreen === 'tripDetail' && this.currentTrip?.id === tripId) {
                this.showTripList();
            } else {
                // Otherwise just refresh the trip list
                this.showTripList();
            }
        }
    },

    /**
     * Hide all screens
     */
    hideAllScreens() {
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('tripListScreen').classList.add('hidden');
        document.getElementById('tripFormScreen').classList.add('hidden');
        document.getElementById('tripDetailScreen').classList.add('hidden');
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = App;
        App.init();
    });
} else {
    window.app = App;
    App.init();
}
