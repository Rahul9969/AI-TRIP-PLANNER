document.addEventListener('DOMContentLoaded', () => {
    const app = {
        currentPage: 'planner-page',
        userProfile: { dietary: '', accessibility: '' },
        selectedVibes: new Set(),
        tripData: null,
        isLiveTrip: false,
        clickedUploadSlot: null,

        navButtons: document.querySelectorAll('.nav-btn'),
        pages: document.querySelectorAll('.page'),
        moodImages: document.querySelectorAll('.mood-image'),
        tripForm: document.getElementById('trip-form'),
        smartNotification: document.getElementById('smart-notification'),
        itinerarySection: document.getElementById('itinerary-section'),
        loadingSpinner: document.getElementById('loading-spinner'),
        inputSection: document.getElementById('input-section'),
        detailModal: document.getElementById('detail-modal'),
        detailModalContent: document.getElementById('detail-modal-content'),
        photoUploadInput: document.getElementById('photo-upload-input'),

        init() {
            this.addEventListeners();
            this.renderPage();
        },

        addEventListeners() {
            this.navButtons.forEach(btn => btn.addEventListener('click', (e) => {
                this.currentPage = e.currentTarget.dataset.page;
                this.renderPage();
            }));
            this.moodImages.forEach(img => img.addEventListener('click', (e) => {
                const vibe = e.currentTarget.dataset.vibe;
                if (this.selectedVibes.has(vibe)) {
                    this.selectedVibes.delete(vibe);
                    e.currentTarget.classList.remove('selected');
                } else {
                    this.selectedVibes.add(vibe);
                    e.currentTarget.classList.add('selected');
                }
            }));
            this.tripForm.addEventListener('submit', this.handleFormSubmit.bind(this));
            document.getElementById('save-profile-btn').addEventListener('click', this.saveProfile.bind(this));
            document.getElementById('close-detail-modal').addEventListener('click', this.hideDetailModal.bind(this));
            this.detailModal.addEventListener('click', (e) => { if (e.target === this.detailModal) this.hideDetailModal(); });
            this.photoUploadInput.addEventListener('change', this.handlePhotoUpload.bind(this));
        },

        renderPage() {
            this.pages.forEach(p => p.classList.toggle('active', p.id === this.currentPage));
            this.navButtons.forEach(b => b.classList.toggle('active', b.dataset.page === this.currentPage));
        },

        saveProfile() {
            this.userProfile.dietary = document.getElementById('dietary-needs').value;
            this.userProfile.accessibility = document.getElementById('accessibility-needs').value;
            alert('Profile Saved!');
        },

        async handleFormSubmit(e) {
            e.preventDefault();
            if(document.getElementById('destination').value.trim() === '' || document.getElementById('duration').value.trim() === ''){
                alert("Please fill out destination and duration.");
                return;
            }

            const formData = {
                destination: document.getElementById('destination').value,
                duration: document.getElementById('duration').value,
                travelStyle: document.getElementById('travelStyle').value,
                vibes: Array.from(this.selectedVibes),
                profile: this.userProfile
            };

            this.inputSection.classList.add('hidden');
            this.loadingSpinner.classList.remove('hidden');

            this.tripData = await this.callGeminiAPI(formData, 'generateItinerary');
            
            this.loadingSpinner.classList.add('hidden');
            if (this.tripData && this.tripData.dailyItinerary) {
                this.displayItinerary();
                this.getLiveWeather(this.tripData.destination);
            } else {
                this.inputSection.classList.remove('hidden');
                alert("AI failed to generate a valid itinerary. Please try again with different inputs.");
            }
        },
        
        displayItinerary() {
            this.itinerarySection.classList.remove('hidden');
            const { destination, dailyItinerary } = this.tripData;
            
            let tabsHTML = `
                <div class="mb-6 flex space-x-2 p-1 bg-slate-900/50 rounded-lg">
                    <button class="iti-tab-btn flex-1 p-3 rounded-md font-semibold transition active" data-tab="iti-daily-plan"><i class="fas fa-route mr-2"></i>Daily Plan</button>
                    <button class="iti-tab-btn flex-1 p-3 rounded-md font-semibold transition" data-tab="iti-journal"><i class="fas fa-book-open mr-2"></i>Photo Journal</button>
                    <button class="iti-tab-btn flex-1 p-3 rounded-md font-semibold transition" data-tab="iti-travelogue"><i class="fas fa-feather-alt mr-2"></i>AI Travelogue</button>
                </div>
            `;

            let dailyPlanHTML = dailyItinerary.map(day => {
                const activitiesHtml = day.activities.map(act => {
                    const imageUrl = `https://image.pollinations.ai/prompt/photorealistic%20${encodeURIComponent(act.imageSearchTerm)}`;
                     return `
                    <button class="activity-item w-full text-left p-2 rounded-lg" data-name="${act.name}" data-image="${imageUrl}" data-description="${act.description}">
                        <div class="flex items-start space-x-4">
                            <div class="bg-cyan-500/20 text-cyan-300 rounded-full h-10 w-10 flex-shrink-0 flex items-center justify-center pointer-events-none"><i class="fas ${act.icon}"></i></div>
                            <div class="pointer-events-none"><h5 class="font-semibold">${act.name}</h5></div>
                        </div>
                    </button>`;
                }).join('');

                return `
                    <div class="glassmorphism rounded-2xl p-6 shadow-lg">
                        <div class="flex items-center mb-4"><span class="bg-cyan-500 text-white text-sm font-bold px-3 py-1 rounded-full mr-3">Day ${day.day}</span><h3 class="text-2xl font-bold">${day.title}</h3></div>
                        <p class="text-slate-300 mb-6">${day.details}</p>
                        <div class="space-y-2 border-l-2 border-cyan-500/30 pl-4 ml-4">${activitiesHtml}</div>
                    </div>`;
            }).join('');

            let journalHTML = dailyItinerary.map(day => `
                <div class="glassmorphism rounded-2xl p-6 shadow-lg">
                     <h3 class="text-xl font-bold mb-4">Day ${day.day}: Add Your Memories</h3>
                     <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="upload-slot aspect-square bg-slate-700 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-600 transition-colors"><i class="fas fa-plus fa-2x text-slate-500 pointer-events-none"></i></div>
                        <div class="upload-slot aspect-square bg-slate-700 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-600 transition-colors"><i class="fas fa-plus fa-2x text-slate-500 pointer-events-none"></i></div>
                     </div>
                </div>
            `).join('<div class="my-6"></div>');

            const itineraryContent = `
                <div class="text-center mb-8">
                   <h2 class="text-3xl md:text-4xl font-bold">Your Itinerary for ${destination}</h2>
                   <div class="mt-4">
                       <button id="start-trip-btn" class="bg-green-500 text-white font-bold py-2 px-5 rounded-full hover:bg-green-600 transition"><i class="fas fa-play mr-2"></i>Start Live Trip</button>
                       <button id="share-trip-btn" class="ml-2 bg-blue-500 text-white font-bold py-2 px-5 rounded-full hover:bg-blue-600 transition"><i class="fas fa-share-alt mr-2"></i>Share</button>
                   </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div class="lg:col-span-2">
                        ${tabsHTML}
                        <div id="iti-daily-plan" class="iti-tab-content space-y-6">${dailyPlanHTML}</div>
                        <div id="iti-journal" class="iti-tab-content hidden space-y-6">${journalHTML}</div>
                        <div id="iti-travelogue" class="iti-tab-content hidden glassmorphism rounded-2xl p-6 shadow-lg">
                             <h3 class="text-xl font-bold mb-4">Your AI-Generated Travelogue</h3>
                             <button id="generate-travelogue-btn" class="w-full bg-purple-500 text-white font-bold py-3 rounded-lg hover:bg-purple-600 transition">Generate My Story</button>
                             <div id="travelogue-content" class="mt-4 text-slate-300 prose"></div>
                        </div>
                    </div>
                    <div class="lg:col-span-1">
                        <div id="itinerary-sidebar" class="sticky top-24 space-y-6">
                             <div id="weather-card" class="hidden glassmorphism rounded-2xl p-6 shadow-lg"></div>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('itinerary-content-wrapper').innerHTML = itineraryContent;

            this.itinerarySection.querySelectorAll('.iti-tab-btn').forEach(btn => btn.addEventListener('click', this.handleItineraryTabClick.bind(this)));
            this.itinerarySection.querySelectorAll('.activity-item').forEach(btn => btn.addEventListener('click', this.handleActivityClick.bind(this)));
            this.itinerarySection.querySelectorAll('.upload-slot').forEach(slot => slot.addEventListener('click', this.handleUploadSlotClick.bind(this)));
            document.getElementById('start-trip-btn').addEventListener('click', this.startLiveTrip.bind(this));
            document.getElementById('share-trip-btn').addEventListener('click', () => alert('Trip URL copied to clipboard! (Simulated)'));
            document.getElementById('generate-travelogue-btn').addEventListener('click', this.generateTravelogue.bind(this));
        },
        
        async getLiveWeather(destination) {
            try {
                const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1`);
                const geoData = await geoResponse.json();
                if (!geoData.results) {
                    throw new Error('Location not found');
                }
                const { latitude, longitude } = geoData.results[0];
                
                const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
                const weatherData = await weatherResponse.json();
                this.displayWeather(weatherData.current_weather);

            } catch (error) {
                console.error("Failed to fetch weather:", error);
                const weatherCard = document.getElementById('weather-card');
                if(weatherCard) weatherCard.classList.add('hidden');
            }
        },

        displayWeather(weather) {
            const weatherCard = document.getElementById('weather-card');
            if (!weatherCard) return;

            const icon = this.getWeatherIcon(weather.weathercode);
            const description = this.getWeatherDescription(weather.weathercode);
            
            weatherCard.innerHTML = `
                <h3 class="text-xl font-bold mb-4 flex items-center"><i class="fas fa-cloud-sun-rain mr-3 text-cyan-300"></i>Live Weather</h3>
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-4xl font-bold">${Math.round(weather.temperature)}&deg;C</p>
                        <p class="text-slate-300">${description}</p>
                    </div>
                    <i class="fas ${icon} text-5xl text-yellow-300"></i>
                </div>
            `;
            weatherCard.classList.remove('hidden');
        },

        getWeatherIcon(code) {
            const icons = {
                0: 'fa-sun', 1: 'fa-cloud-sun', 2: 'fa-cloud-sun', 3: 'fa-cloud',
                45: 'fa-smog', 48: 'fa-smog',
                51: 'fa-cloud-rain', 53: 'fa-cloud-rain', 55: 'fa-cloud-showers-heavy',
                61: 'fa-cloud-rain', 63: 'fa-cloud-rain', 65: 'fa-cloud-showers-heavy',
                71: 'fa-snowflake', 73: 'fa-snowflake', 75: 'fa-snowflake',
                80: 'fa-cloud-showers-heavy', 81: 'fa-cloud-showers-heavy', 82: 'fa-cloud-showers-heavy',
                95: 'fa-bolt', 96: 'fa-bolt', 99: 'fa-bolt'
            };
            return icons[code] || 'fa-question-circle';
        },

        getWeatherDescription(code) {
             const descriptions = {
                0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
                45: 'Fog', 48: 'Depositing rime fog',
                51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
                61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
                71: 'Slight snow fall', 73: 'Moderate snow fall', 75: 'Heavy snow fall',
                80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
                95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
            };
            return descriptions[code] || 'Unknown';
        },
        
        handleItineraryTabClick(e) {
            this.itinerarySection.querySelectorAll('.iti-tab-btn').forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');
            this.itinerarySection.querySelectorAll('.iti-tab-content').forEach(content => {
                content.classList.toggle('hidden', content.id !== e.currentTarget.dataset.tab);
            });
        },

        handleActivityClick(e) {
            const activityButton = e.currentTarget;
            const name = activityButton.dataset.name;
            const image = activityButton.dataset.image;
            const description = activityButton.dataset.description;
            this.showDetailModal(name, image, description);
        },

        handleUploadSlotClick(e) {
            this.clickedUploadSlot = e.currentTarget;
            this.photoUploadInput.click();
        },

        handlePhotoUpload(e) {
            const file = e.target.files[0];
            if (file && this.clickedUploadSlot) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = document.createElement('img');
                    img.src = event.target.result;
                    img.className = 'w-full h-full object-cover rounded-lg';
                    this.clickedUploadSlot.innerHTML = '';
                    this.clickedUploadSlot.appendChild(img);
                    this.clickedUploadSlot.classList.remove('upload-slot', 'bg-slate-700', 'flex', 'items-center', 'justify-center');
                    this.clickedUploadSlot = null;
                };
                reader.readAsDataURL(file);
            }
            e.target.value = '';
        },
        
        showDetailModal(name, image, description) {
            document.getElementById('detail-modal-title').textContent = name;
            const modalImage = document.getElementById('detail-modal-image');
            const fallbackImage = `https://placehold.co/600x400/304159/ffffff?text=${encodeURIComponent(name.split(' ').join('+'))}`;
            
            modalImage.onerror = () => {
                modalImage.src = fallbackImage;
                modalImage.onerror = null; 
            };

            modalImage.src = image; 

            document.getElementById('detail-modal-description').textContent = description;
            this.detailModal.classList.remove('hidden');
            setTimeout(() => this.detailModalContent.classList.remove('scale-95', 'opacity-0'), 50);
        },

        hideDetailModal() {
            this.detailModalContent.classList.add('scale-95', 'opacity-0');
            setTimeout(() => this.detailModal.classList.add('hidden'), 300);
        },

        async generateTravelogue() {
            const btn = document.getElementById('generate-travelogue-btn');
            btn.textContent = 'Writing your story...';
            btn.disabled = true;
            const travelogueData = await this.callGeminiAPI(this.tripData, 'generateTravelogue');
            if (travelogueData) {
                document.getElementById('travelogue-content').innerHTML = `<p>${travelogueData.travelogue.replace(/\n/g, '</p><p>')}</p>`;
            } else {
                 document.getElementById('travelogue-content').textContent = 'Could not generate travelogue at this time.';
            }
            btn.style.display = 'none';
        },

        startLiveTrip() {
            this.isLiveTrip = true;
            alert('Live Trip Mode Activated!');
            if(!document.getElementById('spontaneity-btn')) {
               this.itinerarySection.insertAdjacentHTML('beforeend', `<button id="spontaneity-btn" class="fixed bottom-20 right-4 bg-yellow-500 p-4 rounded-full shadow-lg z-40 text-white"><i class="fas fa-random"></i></button>`);
               document.getElementById('spontaneity-btn').addEventListener('click', this.getSpontaneitySuggestion.bind(this));
            }
            setTimeout(() => this.simulateSmartUpdate('rain'), 5000);
        },
        
        async getSpontaneitySuggestion() {
            alert('Finding a spontaneous activity...');
            const suggestion = await this.callGeminiAPI({ destination: this.tripData.destination }, 'getSpontaneitySuggestion');
            if (suggestion) {
                 this.showSmartNotification(suggestion.text, 'suggestion');
            }
        },

        async simulateSmartUpdate(event) {
            if (!this.isLiveTrip) return;
            const firstOutdoorActivity = this.tripData.dailyItinerary[0].activities.find(a => a.icon.includes('fa-hiking') || a.icon.includes('fa-landmark'));
            if (!firstOutdoorActivity) return;
            const update = await this.callGeminiAPI({ destination: this.tripData.destination, activityToReplace: firstOutdoorActivity.name, reason: event }, 'getSmartUpdate');
            if (update) {
                this.showSmartNotification(`Weather Alert: Rain! I've swapped '${firstOutdoorActivity.name}' with '${update.alternative.name}'.`, 'update');
            }
        },

        showSmartNotification(message, type) {
            this.smartNotification.innerHTML = `<p class="font-semibold">${message}</p>`;
            this.smartNotification.classList.add('show');
            setTimeout(() => this.smartNotification.classList.remove('show'), 6000);
        },

        async callGeminiAPI(data, task) {
            const apiKey = "AIzaSyDCjv3pDNC40kL8Fz4ym6dKybD-uAXux4A";
            const model = 'gemini-1.5-flash-latest';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            let prompt = '';
            
            if (task === 'generateItinerary') {
                const pathInstruction = data.offTheBeatenPath 
                    ? 'IMPORTANT: The user wants to avoid tourist traps. Focus exclusively on hidden gems, local favorites, and off-the-beaten-path locations. Do not recommend major, world-famous tourist attractions.'
                    : 'Include a mix of popular attractions and local spots.';

                prompt = `Create a travel itinerary for a ${data.duration}-day trip to ${data.destination}. Vibe: ${data.vibes.join(', ')}. Style: ${data.travelStyle}. ${pathInstruction} Profile: Dietary: ${data.profile.dietary || 'None'}, Accessibility: ${data.profile.accessibility || 'None'}. Return ONLY a valid JSON object with keys: "destination", "dailyItinerary". dailyItinerary is an array of objects, each with "day", "title", "details", and an "activities" array. Each activity must have "name", "description", "icon" (a valid Font Awesome class name like 'fa-utensils'), and "imageSearchTerm" (a specific, descriptive 2-4 word term for an image search, like 'Eiffel Tower Paris' or 'Tokyo street food night').`;
            } else if (task === 'getSpontaneitySuggestion') {
                prompt = `Suggest one highly-rated, interesting, and quick activity or cafe near the center of ${data.destination} that can be done in the next hour. Return a JSON object: {"text": "suggestion"}`;
            } else if (task === 'getSmartUpdate') {
                prompt = `It is now raining in ${data.destination}. Suggest a single, specific, indoor alternative to "${data.activityToReplace}". Return a JSON object: {"alternative": {"name": "...", "description": "..."}}`;
            } else if (task === 'generateTravelogue') {
                prompt = `Based on this itinerary JSON, write a short, engaging, first-person travel blog post (2-3 paragraphs) summarizing the trip. Itinerary: ${JSON.stringify(data.dailyItinerary)}. Return a JSON object: {"travelogue": "your story..."}`;
            }
            
            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            };

            try {
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) throw new Error(`API Error: ${response.status}`);
                const result = await response.json();
                return JSON.parse(result.candidates[0].content.parts[0].text);
            } catch (error) {
                console.error("Gemini API call failed:", error);
                return null;
            }
        }
    };
    
    app.init();
});


