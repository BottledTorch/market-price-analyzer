// ApiService.js
export const fetchCorrectPrice = async (item, priceList) => {
    let controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
    
        // Append the prompt to the URL as a query parameter
        const url = `http://localhost:3000/getCorrectPrice?item=${encodeURIComponent(item)}&priceList=${encodeURIComponent(priceList)}`;
    
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal,
            });
    
            clearTimeout(timeoutId); // Clear the timeout if the request completes successfully
    
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
    
            const data = await response.json();
            return data.result;
        } catch (error) {
            // Clear the timeout if the request fails
            clearTimeout(timeoutId);
    
            // try one more time
            try {
                controller = new AbortController();
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal,
                });
    
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
    
                const data = await response.json();
                return data.result;
            } catch (innerError) {
                console.error(`Failed to fetch for item: ${item}`, innerError);
                return null;
            }
        }
};

export const fetchGPTCategory = async (item) => {
    const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        // Append the prompt to the URL as a query parameter
        const url = `http://localhost:3000/gptCategory?prompt=${encodeURIComponent(item)}`;

        try {    
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
    
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
    
            const data = await response.json();
            return data.result;
        } catch (error) {
            // try one more time
            clearTimeout(timeoutId);
            try {
                controller = new AbortController();
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal,
                });
        
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
        
                const data = await response.json();
                return data.result;

            } catch {
                
                console.error(`Failed to fetch for item: ${item}`, error);
                return null;
            }
        }
};

export const fetchEbayData = async (item, categoryNum) => {
    let controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
    
        // Append the prompt to the URL as a query parameter
        const url = `http://localhost:3000/getEbayData?itemName=${encodeURIComponent(item)}&category=${encodeURIComponent(categoryNum)}`;
    
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal,
            });
    
            clearTimeout(timeoutId); // Clear the timeout if the request completes successfully
    
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
    
            const data = await response.json();
            return data;
        } catch (error) {
            // Clear the timeout if the request fails
            clearTimeout(timeoutId);
    
            // try one more time
            try {
                controller = new AbortController();
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal,
                });
    
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
    
                const data = await response.json();
                return data;
            } catch (innerError) {
                console.error(`Failed to fetch for item: ${item}`, innerError);
                return null;
            }
        }
};
