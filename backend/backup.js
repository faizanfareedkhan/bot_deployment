const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const XLSX = require("xlsx");

puppeteer.use(StealthPlugin());

(async () => {
    // Launch a browser instance
    const browser = await puppeteer.launch({ headless: false }); // Set headless to false for debugging
    const page = await browser.newPage();
    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.6834.84 (Official Build) (64-bit) Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9",
    });

    try {
        // Navigate to the website
        const url = "https://www.get.it/signin"; // Replace with your desired website
        await page.goto(url, { waitUntil: "load", timeout: 60000 });
        page.setDefaultNavigationTimeout(60000);

        console.log(`Navigated to ${url}`);

        page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

        // Fill out the form
        await page.waitForSelector("#email");
        await page.type("#email", "rivikojy@polkaroad.net"); // Replace #email with the actual selector
        await page.waitForSelector("#password");
        await page.type("#password", "@Waqas12345"); // Replace #password with the actual selector

        console.log("Form filled.");

        // Submit the form
        await page.click('[type="submit"]'); // Replace #submit-button with the actual selector

        console.log("Form submitted successfully!");

        // Wait for navigation after form submission
        await page.waitForResponse(
            (response) =>
                response.url().includes("/dashboard") && response.status() === 200,
            { timeout: 60000 }
        );

        const finalUrl =
            "https://account.get.it/business/huboweb-3/dashboard/listings/jobs?limit=100&page=1&order=created&sort=DESC&state=draft";
        await page.goto(finalUrl, { waitUntil: "load", timeout: 60000 });

        const cookies = await page.cookies();
        // console.log("Cookies:", cookies);

        // Optional: Wait for 10 seconds using a custom timeout
        await new Promise((resolve) => setTimeout(resolve, 10000));

        // Extract job listings from the table
        const jobListings = await page.evaluate(() => {
            let sr = 0; // Define the counter inside the browser context
            const rows = Array.from(document.querySelectorAll("table tbody tr")); // Select all <tr> elements in the table body
            if (rows.length === 0) {
                console.log("No active job found.");
                return [];
            }
            return rows.map((row) => {
                const title =
                    row
                        .querySelector("td.text-left > div > div > a")
                        ?.textContent.trim() || "";
                const location =
                    row.querySelector("td.text-left")?.textContent.trim() || "";
                const postedOn =
                    row.querySelector("td.text-center")?.textContent.trim() || "";
                const status =
                    row.querySelector("td.text-left > div")?.textContent.trim() || "";
                sr++; // Increment inside the map function
                return { sr, title, location, postedOn, status };
            });
        });

        // Optional: Wait for 10 seconds using a custom timeout
        await new Promise((resolve) => setTimeout(resolve, 10000));
        // Log extracted job listings
        console.log("Job Listings:", jobListings);

        // Loop through each row and perform action
        for (const job of jobListings) {
            const { sr, title, location, postedOn, status } = job;
            console.log(
                `Job ${sr}: ${title}, Location: ${location}, Posted on: ${postedOn}, Status: ${status}`
            );

            // Load the Excel file and read the zip codes
            const workbook = XLSX.readFile("zipcodes.xlsx");
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const zipcodes = XLSX.utils
                .sheet_to_json(sheet)
                .map((row) => row.Zipcode);
            console.log(`Zipcodes are: ${zipcodes}`);

            for (let zipcode of zipcodes) {
                // Click on the action button (three dots)
                // await page.click("button.v-btn.v-btn--icon.v-btn--round .v-icon.mdi-dots-vertical");

                // Select the job to act upon based on its serial number
                const desiredSerialNumber = sr;
                const matchedJob = jobListings.find((job) => job.sr === desiredSerialNumber);

                if (matchedJob) {
                    console.log(`Performing action on job:`, matchedJob);

                    // Click the respective three-dot button based on the serial number
                    await page.evaluate((desiredSerialNumber) => {
                        const rows = Array.from(document.querySelectorAll("table tbody tr")); // Get all rows
                        const buttons = Array.from(
                            document.querySelectorAll("button.v-btn.v-btn--icon.v-btn--round .v-icon.mdi-dots-vertical")
                        ); // Get all three-dot buttons
                        const index = desiredSerialNumber - 1; // Convert sr to zero-based index
                        if (buttons[index]) {
                            buttons[index].click(); // Click the button corresponding to the sr number
                        } else {
                            console.log(`Button for serial number ${desiredSerialNumber} not found.`);
                        }
                    }, desiredSerialNumber);
                } else {
                    console.log(`No job found with serial number: ${desiredSerialNumber}`);
                }

                // Optional: Wait for  seconds using a custom timeout
                await new Promise((resolve) => setTimeout(resolve, 5000));

                // Wait for the dropdown menu to appear
                await page.waitForSelector(".v-menu__content.menuable__content__active.theme--light", { visible: true });

                // Optional: Wait for 5 seconds using a custom timeout
                await new Promise((resolve) => setTimeout(resolve, 5000));

                // Find and click the "Duplicate" button
                const menuItems = await page.$$("div[role='menuitem']");
                let clicked = false;

                for (const item of menuItems) {
                    const text = await item.evaluate((el) => el.textContent.trim());
                    if (text === "Duplicate") {
                        await item.click();
                        console.log("Duplicate button clicked.");
                        clicked = true;
                        break;
                    }
                }

                if (!clicked) {
                    console.error("Duplicate button not found.");
                }

                // Optional: Wait for 10 seconds using a custom timeout
                await new Promise((resolve) => setTimeout(resolve, 10000));

                console.log(`Processing job for zipcode: ${zipcode}`);

                // Wait for the job post form to appear with an increased timeout
                await page.waitForSelector('input[data-test="listingFormJob--title"]', {
                    timeout: 20000,
                }); // Wait for the job title input field using data-test

                // Define the new title to set in the input field (replace with your desired title)
                const newTitle = `${location} | ${zipcode}`.replace(/^Copy of\s+/i, "");

                // Set the new title value to the input field and dispatch events
                await page.$eval(
                    'input[data-test="listingFormJob--title"]',
                    (input, newTitle) => {
                        input.value = newTitle;
                        input.dispatchEvent(new Event("input", { bubbles: true }));
                        input.dispatchEvent(new Event("change", { bubbles: true }));
                    },
                    newTitle
                );

                console.log(`Job ${sr} title updated to: ${newTitle}`);

                // Function to enter postal code and validate it
                async function enterPostalCode(postalCode) {
                    const postalCodeString = String(postalCode); // Ensure postalCode is a string
                    // Simulate typing the postal code value into the input field
                    await page.focus('input[data-test="postalCode--input"]'); // Focus the input
                    await page.click('input[data-test="postalCode--input"]', {
                        clickCount: 3,
                    }); // Select the current value
                    await page.keyboard.type(postalCodeString); // Type the new postal code

                    // Simulate clicking outside the input field (e.g., pressing the Tab key)
                    console.log("Pressing Tab key to move focus outside the ZIP code input field...");
                    await page.keyboard.press('Tab');

                    // Wait briefly to allow validation to occur
                    await new Promise((resolve) => setTimeout(resolve, 3000));

                    // Check if the error message appears
                    try {
                        await page.waitForSelector('.v-messages__message', { visible: true, timeout: 2000 });
                        const errorMessage = await page.$eval('.v-messages__message', (el) => el.textContent.trim());

                        if (errorMessage === "Postal Code is invalid") {
                            console.log(`Error: "${errorMessage}". ZIP code "${postalCode}" is invalid.`);
                            return false; // Postal code is invalid
                        }
                    } catch (e) {
                        // No error message means postal code is valid
                        console.log(`No error message. ZIP code "${postalCode}" is valid.`);
                        return true;
                    }

                    return false; // Default to invalid if an error message is found
                }

                // Function to handle clicking the Cancel button
                async function clickCancelButton() {
                    console.log("Clicking the Cancel button...");

                    // Wait for the Cancel button (the span inside the button) to become visible
                    await page.waitForSelector('button.v-btn.v-btn--text.theme--light.v-size--small.primary--text span', { visible: true });

                    // Ensure the Cancel button is within view (scroll if needed)
                    await page.evaluate(() => {
                        const cancelButton = Array.from(document.querySelectorAll('button.v-btn.v-btn--text.theme--light.v-size--small.primary--text span'))
                            .find(span => span.textContent.trim() === "Cancel"); // Find the span with "Cancel" text

                        if (cancelButton) {
                            cancelButton.scrollIntoViewIfNeeded(); // Ensure it scrolls into view if needed
                        }
                    });

                    // Click the parent button of the "Cancel" span
                    await page.evaluate(() => {
                        const cancelButton = Array.from(document.querySelectorAll('button.v-btn.v-btn--text.theme--light.v-size--small.primary--text span'))
                            .find(span => span.textContent.trim() === "Cancel"); // Find the span with "Cancel" text

                        if (cancelButton) {
                            cancelButton.closest('button').click(); // Click the parent button
                        }
                    });

                    console.log("Cancel button clicked successfully.");
                }

                // Function to handle clicking the Post button
                async function clickPostButton() {
                    console.log("Clicking the Post button...");

                    // Optional: Wait for 10 seconds using a custom timeout
                    await new Promise((resolve) => setTimeout(resolve, 10000));

                    // Wait for the "Post" button to be visible using the class selector
                    await page.waitForSelector("button.v-btn--is-elevated", {
                        visible: true,
                    });

                    // Ensure the Post button is within view (scroll if needed) and click it
                    await page.evaluate(() => {
                        const postButton = Array.from(document.querySelectorAll('button.v-btn--is-elevated'))
                            .find(span => span.textContent.trim() === "Post");

                        if (postButton) {
                            postButton.closest('button').click(); // Click the parent button
                        }
                    });

                    console.log("Post button clicked successfully.");
                    // Optional: Wait for 15 seconds using a custom timeout
                    await new Promise((resolve) => setTimeout(resolve, 15000));
                }

                // Main ZIP code validation logic
                async function handleZipCodeValidation(postalCode) {
                    const postalCodeString = String(postalCode);

                    // Check if the postal code is a 5-digit number
                    if (!/^[0-9]{5}$/.test(postalCodeString)) {
                        console.log(`Postal code "${postalCode}" is not a valid 5-digit number. Clicking the Cancel button.`);
                        await clickCancelButton();
                        return;
                    }

                    let attempt = 0;
                    let isValid = false;

                    // Try validating the ZIP code up to 3 times
                    while (attempt < 3 && !isValid) {
                        console.log(`Attempt ${attempt + 1}: Validating ZIP code "${postalCode}"...`);
                        isValid = await enterPostalCode(postalCode);
                        attempt++;

                        if (isValid) {
                            console.log(`ZIP code "${postalCode}" is valid.`);
                            await clickPostButton();
                            // After posting, check if the success screen is displayed
                            try {
                                await page.waitForSelector('#congrats-free-title', { visible: true, timeout: 5000 });
                                console.log("Success screen detected. Navigating to Manage Your Jobs...");
                                // Navigate to the jobs page after clicking
                                await page.goto('https://account.get.it/business/huboweb-3/dashboard/listings/jobs?limit=100&page=1&order=created&sort=DESC&state=draft');
                                console.log(`Job re-posted successfully against "${postalCode}".`);
                            } catch (e) {
                                console.log("Success screen not detected. Proceeding to the next iteration.");
                                // Navigate to the jobs page after clicking
                                await page.goto('https://account.get.it/business/huboweb-3/dashboard/listings/jobs?limit=100&page=1&order=created&sort=DESC&state=draft');
                                console.log(`Job re-posted successfully against "${postalCode}".`);
                            }

                            return; // Exit the function after posting
                        }
                    }

                    // If all attempts fail, click the Cancel button
                    if (!isValid) {
                        console.log(`ZIP code "${postalCode}" is invalid after 3 attempts. Clicking the Cancel button.`);
                        await clickCancelButton();
                    }
                }

                const postalCode = zipcode; // Assuming "zipcode" is defined elsewhere
                console.log(`Setting postal code: "${postalCode}"`);
                await handleZipCodeValidation(postalCode);

                // Wait for 30 seconds using a custom timeout
                await new Promise((resolve) => setTimeout(resolve, 20000));
            }

            // Using setTimeout for manual delay instead of waitForTimeout
            // await new Promise((resolve) => setTimeout(resolve, 600000));

            console.log(`Jobs are re-posted against each zip code.`);
        }

        // Optionally take a screenshot after submission
        // await page.screenshot({ path: 'form-filled.png' });
    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        // Close the browser
        console.log(`Bot executed successfully.`);
        await browser.close();
    }
})();