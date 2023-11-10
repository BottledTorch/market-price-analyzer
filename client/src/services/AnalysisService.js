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
    

    console.log(combinedRowsData)

    let columnData = combinedRowsData;

    // Extract data from the selected column
    // const columnData = data.map(row => row[column]).filter(item => item !== undefined);
    console.log(`Data from combined column:`, columnData);

    // Remove commas from each string in columnData
    const cleanedColumnData = columnData.map(item => (typeof item === 'string' ? item.replace(/,/g, '') : item));

    const items = [];
    const updates = []; // Array to accumulate updates

    for (let index = 0; index < cleanedColumnData.length; index++) {
        setProgress(((index + 1) / (cleanedColumnData.length*2)) * 100);
        const item = {
            name: cleanedColumnData[index],
            categories: []
        };

        // Check if the item is a UPC code
        if (isUPC(item.name)) {
            console.log(`Item ${item.name} is a UPC. Skipping category fetching.`);
        } else {
            try {
                console.log(item.name)
                let categories = await fetchGPTCategory(item.name);
                const categoryNumbers = (categories.match(/#(\d+)/g) || []).map(match => parseInt(match.slice(1), 10));
                item.categories = categoryNumbers;
            } catch (error) {
                console.error(`Error processing item at index ${index}:`, error);
            }
        }

        items.push(item);
        
    }

    console.log("Category Detection Complete");

    for (let index = 0; index < items.length; index++) {
        setProgress(((index + 1) / (cleanedColumnData.length*2)) * 100 + 50);
        let item = items[index];
        let itemResults = [];

        

        if (isUPC(item.name)) {
            let result = await fetchEbayData(item.name);
            console.log(result);
            itemResults.push(result);
            // Accumulate the update in the updates array
            updates.push({
                row: index + 1, // Current row index
                prediction: result.average_price || -1
            });
            continue;
        } else {
            for (let category of item.categories) {
                try {
                    console.log(item)
                    let result = await fetchEbayData(item.name, category);
                    console.log(result)
                    itemResults.push(result);
                } catch (error) {
                    console.error(`Error processing item at index ${index}:`, error);
                    itemResults.push(null); // Push null or a default value for failed fetches
                }
            }
            let guess = ``;
            let prices = [];
            for (let i = 0; i < 3; i++) {
                const currentItem = itemResults[i];
                
                if (currentItem == null || currentItem.average_price == null) {
                    prices.push('-1');

                    guess += `guess: ${i}`+
                    `\taverage_price: -1` +
                    `\tmax_price: -1` +
                    `\tmin_price: -1` +
                    `\tnum_results: -1\n`;
                    continue;
                }
                prices.push(currentItem.average_price);

                guess += `guess: ${i}`+
                    `\taverage_price: ${parseFloat(currentItem.average_price).toFixed(2)}` +
                    `\tmax_price: ${currentItem.max_price}` +
                    `\tmin_price: ${currentItem.min_price}` +
                    `\tnum_results: ${currentItem.num_results}\n`;
            }

            if (guess === "" || (prices.length === 3 && prices.every(val => val === '-1'))) {
                continue;
            }
            
            let result = await fetchCorrectPrice(item.name, guess);
            console.log(item.name);
            console.log(result);
            console.log(prices);

            // Extract the JSON string from the result using a regex
            const jsonPattern = /{[^}]+}/; 
            const jsonString = (result.match(jsonPattern) || [])[0];

            if (jsonString) {
                result = JSON.parse(jsonString);
                console.log(prices[result.guess]);
    
                // Accumulate the update in the updates array
                updates.push({
                    row: index + 1, // Current row index
                    prediction: prices[result.guess]
                });
            } else {
                console.error("Failed to extract JSON from result:", result);
            }
        }
    }

    updateExcel(file, updates);
}
