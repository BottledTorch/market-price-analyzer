import React, { useState } from 'react';
import * as XLSX from 'xlsx';

import { updateExcel } from './services/ExcelService'
import { startAnalysis } from './services/AnalysisService';

function ExcelUpload() {
    const [data, setData] = useState([]);
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [file, setFile] = useState(null); // Convert 'file' to a state variable
    const [progress, setProgress] = useState(0); // 0 to 100
    const [testResults, setTestResults] = useState([]);
    const [analysisResults, setAnalysisResults] = useState([]);
    const [showPopup, setShowPopup] = useState(false);

    const onFileChange = async (e) => {
        const selectedFile = e.target.files[0];
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
    
    // Function to handle column selection and print column data to the console
    const handleColumnSelect = async (column) => {
        // If the column is already selected, remove it. Otherwise, add it.
        if (selectedColumns.includes(column)) {
            setSelectedColumns(prevColumns => prevColumns.filter(col => col !== column));
        } else {
            setSelectedColumns(prevColumns => [...prevColumns, column]);
        }
    };

    const handleStartAnalysis = async () => {
        // Ensure there is data and selected columns to analyze
        if (data.length === 0 || selectedColumns.length === 0) {
            alert("Please upload data and select columns for analysis.");
            return;
        }
    
        try {
            setProgress(0); // Initialize progress to 0
            const results = await startAnalysis(data, selectedColumns, setProgress);
    
            // Format the results for updateExcel
            const formattedResults = results.map((result, index) => ({
                row: index + 1, // Assuming the row index starts from 1 in the Excel file
                prediction: result['estimatedPrice'] // Assuming result is the prediction value
            }));
    
            // Update the Excel file with the formatted results
            updateExcel(file, formattedResults);
    
            // Set the analysis results to state and show the popup
            setAnalysisResults(results);
            setShowPopup(true);
        } catch (error) {
            console.error("Error during analysis:", error);
            alert("An error occurred during analysis. Please check the console for more details.");
        }
    };
    
    

    const handleTestButtonClick = async () => {
        setProgress(0); 
        if (data.length === 0 || selectedColumns.length === 0) {
            alert("Please upload a file and select columns first.");
            return;
        }

        // Select 10 random rows for testing
        const sampleData = selectRandomRows(data, 2);
        console.log("Sample Data for Testing:", sampleData); // Log the sample data
        const testResults = await startAnalysis(sampleData, selectedColumns, setProgress);
        console.log("Test Results:", testResults); // Log the test results
        setTestResults(testResults);
        setShowPopup(true);
        setProgress(100); 
    };

    const selectRandomRows = (data, count) => {
        // Randomly select 'count' rows from 'data'
        return data.sort(() => 0.5 - Math.random()).slice(0, count);
    };

    const renderPopup = () => {
        if (!showPopup) return null;

        return (
            <div className="popup">
                {testResults.map((result, index) => (
                    <div key={index}>
                        Item: {result.itemName}, Estimated Price: {result.estimatedPrice}
                    </div>
                ))}
                <button onClick={() => setShowPopup(false)}>Close</button>
            </div>
        );
    };



    // JSX for rendering the file upload input and table
    return (
        <div>
            <input type="file" onChange={onFileChange} />
            {data.length > 0 && (
                <>
                    <div>
                        <button onClick={handleStartAnalysis}>Start Analysis</button>
                        <button onClick={() => window.location.reload()}>Stop</button>
                        <button onClick={handleTestButtonClick}>Test Configuration</button>
                        {renderPopup()}
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
