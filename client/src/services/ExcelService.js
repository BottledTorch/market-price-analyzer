import * as XLSX from 'xlsx';

export async function updateExcel(file, dataToUpdate) {
    try {
        console.log('updating excel:', dataToUpdate)
        // Read the uploaded Excel file
        const reader = new FileReader();
        let colIndex = 0;
        let updatedRows = 0; // Counter for updated rows
        reader.onload = function(e) {
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            // Determine the total number of rows in the sheet
            const totalRows = XLSX.utils.decode_range(sheet['!ref']).e.r;

            // Find the next available column index
            while (sheet[XLSX.utils.encode_cell({ r: 0, c: colIndex })]) {
                colIndex++;
            }

            // Set the header for the new column
            const headerCellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
            sheet[headerCellRef] = { t: 's', v: 'MPA ESTIMATE' };

            // Update the Excel file based on dataToUpdate
            for (const update of dataToUpdate) {
                const { row, prediction } = update;

                const cellRef = XLSX.utils.encode_cell({ r: row, c: colIndex });
                if (!sheet[cellRef] || sheet[cellRef].v !== prediction) {
                    sheet[cellRef] = { t: 'n', v: prediction };
                    updatedRows++; // Increment the counter for updated rows
                }
            }

            // Alert to show how many rows were updated out of total rows
            alert(`${updatedRows}/${totalRows} rows were updated`);

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
