// AnalysisService.js
import { fetchGPTCategory, fetchEbayData, fetchCorrectPrice } from './ApiService';
import { isUPC } from './Utils';
import { updateExcel } from './ExcelService';

export const startAnalysis = async (file, data, selectedColumns, setProgress) => {
    const combinedRowsData = data.map(row => {
        return selectedColumns
            .map(col => row[col])
            .filter(item => item !== undefined)
            .join(' ');
    });

    console.log(combinedRowsData);

    // Remove commas from each string in columnData
    const cleanedColumnData = combinedRowsData.map(item => 
        typeof item === 'string' ? item.replace(/,/g, '') : item
    );

    const items = [];
    const updates = []; // Array to accumulate updates

    // Process each item to detect categories
    for (let index = 0; index < cleanedColumnData.length; index++) {
        setProgress(((index + 1) / (cleanedColumnData.length * 2)) * 100);
        const itemName = cleanedColumnData[index];
        const item = { name: itemName, categories: [] };

        if (!isUPC(itemName)) {
            await processItemCategories(item, index);
        }

        items.push(item);
    }

    console.log("Category Detection Complete");

    // Process each item to fetch price data and make predictions
    for (let index = 0; index < items.length; index++) {
        setProgress(((index + 1) / (cleanedColumnData.length * 2)) * 100 + 50);
        const item = items[index];

        if (isUPC(item.name)) {
            await processUPCItem(item, index, updates);
        } else {
            await processNonUPCItem(item, index, updates);
        }
    }

    // Update the Excel file with the new data
    updateExcel(file, updates);
};

async function processItemCategories(item, index) {
    try {
        console.log(item.name);
        const categories = await fetchGPTCategory(item.name);
        item.categories = extractCategoryNumbers(categories);
    } catch (error) {
        console.error(`Error processing item at index ${index}:`, error);
    }
}

function extractCategoryNumbers(categories) {
    return (categories.match(/#(\d+)/g) || []).map(match => parseInt(match.slice(1), 10));
}

async function processUPCItem(item, index, updates) {
    try {
        const result = await fetchEbayData(item.name);
        console.log(result);
        updates.push(createUpdateObject(index, result.average_price));
    } catch (error) {
        console.error(`Error processing UPC item at index ${index}:`, error);
        updates.push(createUpdateObject(index, -1));
    }
}

async function processNonUPCItem(item, index, updates) {
    const itemResults = await fetchItemResults(item, index);
    const prices = itemResults.map(res => res ? res.average_price : '-1');
    const guessString = createGuessString(itemResults);

    if (guessString && !prices.every(val => val === '-1')) {
        await makeFinalPrediction(item, index, prices, guessString, updates);
    }
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

async function makeFinalPrediction(item, index, prices, guessString, updates) {
    try {
        const result = await fetchCorrectPrice(item.name, guessString);
        console.log(guessString, result)
        const jsonPattern = /{[^}]+}/;
        const jsonString = (result.match(jsonPattern) || [])[0];

        if (jsonString) {
            const parsedResult = JSON.parse(jsonString);
            updates.push(createUpdateObject(index, prices[parsedResult.guess]));
        } else {
            console.error("Failed to extract JSON from result:", result);
        }
    } catch (error) {
        console.error(`Error making final prediction for item at index ${index}:`, error);
    }
}

function createUpdateObject(index, prediction) {
    return {
        row: index + 1,
        prediction: prediction !== undefined ? prediction : -1
    };
}
