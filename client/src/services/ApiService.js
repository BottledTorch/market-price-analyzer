// ApiService.js
const fetchWithRetry = async (url, options, retries = 1) => {
    let controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    options.signal = controller.signal;

    try {
        const response = await fetch(url, options);
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (retries > 0) {
            console.warn(`Retrying fetch for url: ${url}. Retries left: ${retries}`);
            return fetchWithRetry(url, options, retries - 1);
        } else {
            console.error(`Failed to fetch for url: ${url}`, error);
            throw error;
        }
    }
};

export const fetchCorrectPrice = async (item, priceList) => {
    const url = `http://localhost:3000/getCorrectPrice?item=${encodeURIComponent(item)}&priceList=${encodeURIComponent(priceList)}`;
    try {
        const data = await fetchWithRetry(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        return data.result;
    } catch (error) {
        return null;
    }
};

export const fetchGPTCategory = async (item) => {
    const url = `http://localhost:3000/gptCategory?prompt=${encodeURIComponent(item)}`;
    try {
        const data = await fetchWithRetry(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        return data.result;
    } catch (error) {
        return null;
    }
};

export const fetchEbayData = async (item, categoryNum) => {
    const url = `http://localhost:3000/getEbayData?itemName=${encodeURIComponent(item)}&category=${encodeURIComponent(categoryNum)}`;
    try {
        const data = await fetchWithRetry(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        return data;
    } catch (error) {
        return null;
    }
};
