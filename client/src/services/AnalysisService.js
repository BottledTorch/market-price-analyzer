import { fetchGPTCategory, fetchEbayData, fetchCorrectPrice } from './ApiService';
import { isUPC } from './Utils';

export const startAnalysis = async (data, selectedColumns, setProgress) => {
    const combinedRowsData = data.map(row => {
        return selectedColumns
            .map(col => row[col])
            .filter(item => item !== undefined)
            .join(' ');
    });

    console.log(combinedRowsData);

    const cleanedColumnData = combinedRowsData.map(item => 
        typeof item === 'string' ? item.replace(/,/g, '') : item
    );

    const items = [];
    const results = []; // Array to accumulate results for the popup

    for (let index = 0; index < cleanedColumnData.length; index++) {
        setProgress((index / cleanedColumnData.length) * 50);
        const itemName = cleanedColumnData[index];
        const item = { name: itemName, categories: [] };

        if (!isUPC(itemName)) {
            await processItemCategories(item, index);
        }

        items.push(item);
    }

    console.log("Category Detection Complete");

    for (let index = 0; index < items.length; index++) {
        setProgress(50 + (index / items.length) * 50);
        const item = items[index];

        if (isUPC(item.name)) {
            const price = await processUPCItem(item, index);
            results.push({ itemName: item.name, estimatedPrice: roundToTwoDecimals(price) });
        } else {
            const price = await processNonUPCItem(item, index);
            results.push({ itemName: item.name, estimatedPrice: roundToTwoDecimals(price) });
        }
    }

    return results; // Return the results for the popup
};

// Helper function to round a number to two decimal places
function roundToTwoDecimals(num) {
    return num ? parseFloat(num.toFixed(2)) : num;
}

async function processItemCategories(item, index) {
    try {
        const categories = await fetchGPTCategory(item.name);
        item.categories = extractCategoryNumbers(categories);
    } catch (error) {
        console.error(`Error processing item at index ${index}:`, error);
    }
}

function extractCategoryNumbers(categories) {
    return (categories.match(/#(\d+)/g) || []).map(match => parseInt(match.slice(1), 10));
}

async function processUPCItem(item, index) {
    try {
        const result = await fetchEbayData(item.name);
        return result.average_price;
    } catch (error) {
        console.error(`Error processing UPC item at index ${index}:`, error);
        return -1;
    }
}

async function processNonUPCItem(item, index) {
    const itemResults = await fetchItemResults(item, index);
    const prices = itemResults.map(res => res ? res.average_price : '-1');
    const guessString = createGuessString(itemResults);

    if (guessString && !prices.every(val => val === '-1')) {
        const price = await makeFinalPrediction(item, index, prices, guessString);
        return price;
    }
    return -1;
}

async function fetchItemResults(item, index) {
    const itemResults = [];
    for (const category of item.categories) {
        try {
            const result = await fetchEbayData(item.name, category);
            itemResults.push(result);
        } catch (error) {
            console.error(`Error fetching data for item at index ${index}, category ${category}:`, error);
            itemResults.push(null);
        }
    }
    return itemResults;
}

function createGuessString(itemResults) {
    return itemResults.map((currentItem, i) => {
        if (!currentItem || currentItem.average_price == null) {
            return `guess: ${i}\taverage_price: -1\tmax_price: -1\tmin_price: -1\tnum_results: -1\n`;
        }
        return `guess: ${i}` +
            `\taverage_price: ${parseFloat(currentItem.average_price).toFixed(2)}` +
            `\tmax_price: ${currentItem.max_price}` +
            `\tmin_price: ${currentItem.min_price}` +
            `\tnum_results: ${currentItem.num_results}\n`;
    }).join('');
}

async function makeFinalPrediction(item, index, prices, guessString) {
    try {
        const result = await fetchCorrectPrice(item.name, guessString);
        const jsonPattern = /{[^}]+}/;
        const jsonString = (result.match(jsonPattern) || [])[0];

        if (jsonString) {
            const parsedResult = JSON.parse(jsonString);
            return prices[parsedResult.guess];
        } else {
            console.error("Failed to extract JSON from result:", result);
            return -1;
        }
    } catch (error) {
        console.error(`Error making final prediction for item at index ${index}:`, error);
        return -1;
    }
}
