require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const request = require('request');
const OpenAI = require("openai");

const app = express();
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
app.use(express.json());
app.use(cors());

const storage = multer.memoryStorage(); // Store the file in memory
const upload = multer({ storage: storage });

let uploadedWorkbookBuffer = null; // Store the uploaded Excel buffer here

console.log(process.env.OPENAI_API_KEY)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

app.get("/gptCategory", async (req, res) => {
    try {
        const tempPrompt = req.query.prompt;
        const itemsArr = tempPrompt.split(',').filter(item => item.trim() !== '' && item.toLowerCase() !== 'na' && item.toLowerCase() !== 'undefined');

        const categories = "Categories: Antiques #20081, Art #550, Baby #2984, Books & Mags #267, Business & Industrial #12576, Cameras & Photo #625, Cell Phones & Acc #15032, Clothing & Shoes #11450, Coins & Money #11116, Collectibles #1, Computers & Networking #58058, Consumer Electronics #293, Crafts #14339, Dolls & Bears #237, Entertainment Mem #45100, Everything Else #99, Gift Cards & Coupons #172008, Health & Beauty #26395, Home & Garden #11700, Jewelry & Watches #281, Movies & TV #11232, Music #11233, Musical Instruments #619, Pet Supplies #1281, Pottery & Glass #870, Real Estate #10542, Specialty Services #316, Sporting Goods #888, Sports Mem & Cards #64482, Stamps #260, Tickets & Experiences #1305, Toys & Hobbies #220, Travel #3252, Video Games & Consoles #1249";
        const itemsList = itemsArr.map((item, index) => `${index + 1}: ${item.trim()}`).join('\n');

        const messages = [
            { role: "system", content: "You are an assistant" },
            { role: "user", content: `${categories} Correctly categorize the following item, be as concise as possible with the response, and do not include the item name, only use the item number. List the top 3 most likely categories the item, an example of a correct response is: Clothing & Shoes #11450, Sporting Goods #888, Travel #3252:\n${itemsList}` }
        ];

        const chatCompletion = await queryOpenAI(messages);

        res.json({
            status: "success",
            result: chatCompletion.choices[0].message.content,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

app.get("/getCorrectPrice", async (req, res) => {
    try {
        const item = req.query.item;
        const priceList = req.query.priceList;

        const messages = [
            { role: "system", content: "You are an assistant" },
            { role: "user", content: `Given the item: ${item}, please select the most accurate guess considering the price estimate from the following options: ${priceList}. Note that -1 is never the correct answer. Double check your answer to be as accurate as possible. Specify your guess in the following format: { "guess": X }, for example, { "guess": 2 } if you believe that number 2 is the correct answer.`  }
        ];

        const chatCompletion = await queryOpenAI(messages);

        res.json({
            status: "success",
            result: chatCompletion.choices[0].message.content,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

app.get("/getEbayData", (req, res) => {
    try {
        const itemName = req.query.itemName;
        const category_id = req.query.category;
        const additionalExcluded = req.query.excluded;

        const aspects = req.query.aspects ? JSON.parse(req.query.aspects) : [];

        console.log(itemName, category_id);

        var options = {
            'method': 'POST',
            'url': 'https://ebay-average-selling-price.p.rapidapi.com/findCompletedItems',
            'headers': {
                'Content-Type': 'application/json',
                'x-rapidapi-host': 'ebay-average-selling-price.p.rapidapi.com',
                'x-rapidapi-key': 'd3cbf1bca1mshee13b4d0ca3f4f9p1133bdjsn620d307120b2',
            },
            body: JSON.stringify({
                "keywords": itemName,
                "excluded_keywords": additionalExcluded + "locked cracked case box read damaged",
                "max_search_results": "240",
                "category_id": category_id,
                "site_id": "0",
                "aspects": aspects
            })
        };

        request(options, function (error, response) {
            try {
                if (error) throw error;

                response = JSON.parse(response.body);
                const prices = response.products.map(product => product.sale_price);

                // Find outliers (values outside a specified range)
                const averagePrice = prices.reduce((acc, price) => acc + price, 0) / prices.length;
                const lowerLimit = averagePrice * 0.5; // 30% below average
                const upperLimit = averagePrice * 1.75; // 30% above average
                const filteredPrices = prices.filter(price => price >= lowerLimit && price <= upperLimit);
                const outliers = prices.filter(price => price < lowerLimit || price > upperLimit);

                // Calculate min, max, and average from filtered prices
                const minPrice = Math.min(...filteredPrices);
                const maxPrice = Math.max(...filteredPrices);
                const averageFilteredPrice = filteredPrices.reduce((acc, price) => acc + price, 0) / filteredPrices.length;

                res.json({
                    status: response.success,
                    average_price: averageFilteredPrice,
                    min_price: minPrice,
                    max_price: maxPrice,
                    num_results: response.results,
                    num_outliers: outliers.length
                });
            } catch (err) {
                console.error(err);
                res.status(500).json({ status: "error", message: "Internal server error" });
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

// Recursive function to query OpenAI
async function queryOpenAI(messages) {
    const chatCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages,
        temperature: 0
    });

    if (!chatCompletion.choices || chatCompletion.choices.length === 0) {
        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                try {
                    const result = await queryOpenAI(messages);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            }, 10000); // Retry after 10 seconds
        });
    }

    return chatCompletion;
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
});
