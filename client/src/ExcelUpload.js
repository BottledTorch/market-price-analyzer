import React, { useState } from 'react';
import * as XLSX from 'xlsx';

import { startAnalysis } from './services/AnalysisService';

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



    // JSX for rendering the file upload input and table
    return (
        <div>
            <input type="file" onChange={onFileChange} />
            {data.length > 0 && (
                <>
                    <div>
                        <button onClick={() => startAnalysis(file, data, selectedColumns, setProgress)}>Start Analysis</button>
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
