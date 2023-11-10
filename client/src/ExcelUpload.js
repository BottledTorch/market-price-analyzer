import React, { useState } from 'react';
import * as XLSX from 'xlsx';

function ExcelUpload() {
    const [data, setData] = useState([]);
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [file, setFile] = useState(null); // Convert 'file' to a state variable
    const [progress, setProgress] = useState(0); // 0 to 100

    const onFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        console.log(selectedFile)
        if (selectedFile !== undefined) {
            setProgress(0);
            setFile(selectedFile); // Set the state of the 'file' variable

            const reader = new FileReader();

            reader.onload = (event) => {
                const workbook = XLSX.read(event.target.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                setData(sheetData);
            };

            reader.readAsBinaryString(selectedFile);
        } else {
            console.log("Could not read file")
        }
    };

    
    // Function to check if a string is a UPC code
    const isUPC = (str) => {
        const upcPattern = /^\d{11,13}$/;
        return upcPattern.test(str);
    };

    // Function to update Excel with the prediction
    async function updateExcel(dataToUpdate) {
        try {
            console.log('updating excel:', dataToUpdate)
            // Read the uploaded Excel file
            const reader = new FileReader();
            let colIndex = 0;
            reader.onload = function(e) {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
    
                // Update the Excel file based on dataToUpdate
                for (const update of dataToUpdate) {
                    console.log(update)

                    const { row, prediction } = update;
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    
                    if (colIndex === 0) {
                        while (sheet[XLSX.utils.encode_cell({ r: 1, c: colIndex })]) {
                            colIndex++;
                        }
                    }

                    console.log(colIndex)
    
                    const cellRef = XLSX.utils.encode_cell({ r: row, c: colIndex });
                    sheet[cellRef] = { t: 'n', v: prediction };
                }
    
                // Convert the updated workbook to a Blob and trigger a download
                const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });
                const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'updated-file.xlsx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                console.log("Excel updated and downloaded successfully!");
            };
            reader.readAsBinaryString(file);
        } catch (error) {
            console.error("Error updating Excel:", error.message, error.stack);
        }
    }
    
    // Helper function to convert string to ArrayBuffer
    function s2ab(s) {
        const buf = new ArrayBuffer(s.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < s.length; i++) {
            view[i] = s.charCodeAt(i) & 0xFF;
        }
        return buf;
    }
    
    
    // Function to handle column selection and print column data to the console
    const handleColumnSelect = async (column) => {
        // If the column is already selected, remove it. Otherwise, add it.
        if (selectedColumns.includes(column)) {
            setSelectedColumns(prevColumns => prevColumns.filter(col => col !== column));
        } else {
            setSelectedColumns(prevColumns => [...prevColumns, column]);
        }

        console.log(selectedColumns)
    };

    const startAnalysis = async () => {
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

        updateExcel(updates);
    }

    
    async function fetchCorrectPrice(item, priceList) {
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
    }
    
    async function fetchGPTCategory(item) {
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
    }

    async function fetchEbayData(item, categoryNum) {
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
    }
    
    

    // JSX for rendering the file upload input and table
    return (
        <div>
            <input type="file" onChange={onFileChange} />
            {data.length > 0 && (
                <>
                    <div>
                        <button onClick={startAnalysis}>Start Analysis</button>
                        <button onClick={() => window.location.reload()}>Stop</button>
                    </div>

                    <div className="progress-container">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                        <div className="progress-text">{progress.toFixed(0)}%</div> {/* Display percentage */}
                    </div>

                    <table>
                        <thead>
                            {/* Render table headers with onClick handler for column selection */}
                            <tr>
                                {Object.keys(data[0] || {}).map((header, index) => (
                                    <th 
                                        key={index} 
                                        onClick={() => handleColumnSelect(header)}
                                        style={{ backgroundColor: selectedColumns.includes(header) ? 'lightgray' : 'transparent' }} // Highlight if selected
                                    >
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {/* Render table rows and cells with data from the Excel file */}
                            {data.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                    {Object.values(row).map((cell, cellIndex) => (
                                        <td key={cellIndex}>{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );

}

export default ExcelUpload;
