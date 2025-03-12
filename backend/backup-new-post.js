const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();
const port = 5000;

app.use(bodyParser.json());

app.post("/new-post", async (req, res) => {
    const { username, password, jobData } = req.body;
    if (!username || !password || !jobData) {
        return res.status(400).send("Username, password, and job data are required");
    }

    try {
        const browser = await puppeteer.launch({
            headless: false,
            args: ["--start-maximized"],
        });
        const page = await browser.newPage();
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.6834.84 Safari/537.36"
        );

        await page.setExtraHTTPHeaders({
            "Accept-Language": "en-US,en;q=0.9",
        });

        const loginUrl = "https://www.get.it/signin";
        await page.goto(loginUrl, { waitUntil: "load", timeout: 60000 });
        console.log(`Navigated to ${loginUrl}`);

        await page.waitForSelector("#email");
        await page.type("#email", username);
        await page.waitForSelector("#password");
        await page.type("#password", password);

        console.log("Form filled. Logging in...");
        await page.click('[type="submit"]');

        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 });
        console.log("Login successful. Current URL:", page.url());

        const postAdUrl = "https://account.get.it/post-ad/job";
        await page.goto(postAdUrl, { waitUntil: "load", timeout: 60000 });
        console.log(`Navigated to ${postAdUrl}`);

        console.log("Filling out the job posting form...");

        // add title
        await page.waitForSelector('input[data-test="listingFormJob--title"]');
        await page.type('input[data-test="listingFormJob--title"]', jobData.title);
        console.log(`Title added: ${jobData.title}`);

        // add description
        await page.waitForSelector('textarea[data-test="listingFormJob--description"]');
        await page.type('textarea[data-test="listingFormJob--description"]', jobData.description);
        console.log(`Description added: ${jobData.description}`);

        // add employee type
        if (jobData.employeesType === "In office only") {
            await page.click('input[value="IN_OFFICE"]');
        } else if (jobData.employeesType === "Remote accepted or Remote Only") {
            await page.click('input[value="TELECOMMUTE"]');
        }
        console.log(`Employee type added: ${jobData.employeesType}`);

        // add country

        console.log(`Selecting country: ${jobData.country}`);

        // Skip country selection if it's "United States"
        if (jobData.country !== "United States") {
            console.log("Country is NOT United States. Proceeding with country selection...");

            // Wait for the country input field and type the country name
            await page.waitForSelector('input[data-test="country"]', { visible: true });
            await page.click('input[data-test="country"]'); // Click the input field
            await page.type('input[data-test="country"]', jobData.country, { delay: 100 }); // Type slowly
            console.log(`Typed country: ${jobData.country}`);

            // Wait for the dropdown to appear
            await page.waitForSelector('.v-list.v-select-list', { visible: true });
            console.log("Country dropdown appeared.");

            // Wait for the country item to become visible after filtering
            const countrySelector = `.v-list-item .v-list-item__title`;
            const countryFound = await page.evaluate((selector, country) => {
                const items = Array.from(document.querySelectorAll(selector));
                return items.some((item) => item.textContent.trim() === country);
            }, countrySelector, jobData.country);

            if (!countryFound) {
                console.error(`Error: Country "${jobData.country}" not found in the dropdown.`);
                throw new Error(`Country "${jobData.country}" not found. Exiting bot.`);
            }

            console.log(`Country "${jobData.country}" is now visible in the dropdown.`);

            // Click on the country
            await page.evaluate((country, selector) => {
                const countryOptions = document.querySelectorAll(selector);
                const countryOption = Array.from(countryOptions).find(
                    (item) => item.textContent.trim() === country
                );
                if (countryOption) {
                    countryOption.click();
                    console.log(`Clicked on country: ${country}`);
                }
            }, jobData.country, countrySelector);

            // Click outside to ensure dropdown closes
            await page.click('body');
        } else {
            console.log("Country is United States. Skipping country selection.");
        }

        // Click outside to ensure dropdown closes
        await page.click('body');

        // Function to enter ZIP code and validate it
        async function enterPostalCode(postalCode) {
            const postalCodeString = String(postalCode); // Ensure postal code is a string

            console.log(`Entering ZIP code: ${postalCodeString}`);

            // Click and focus the ZIP code input field
            await page.waitForSelector('input[data-test="postalCode--input"]', { visible: true });
            await page.focus('input[data-test="postalCode--input"]');
            await page.click('input[data-test="postalCode--input"]', { clickCount: 3 }); // Select and clear existing value

            // Type the new ZIP code
            await page.keyboard.type(postalCodeString);

            // Move focus outside the input field (simulate validation trigger)
            console.log("Pressing Tab key to trigger validation...");
            await page.keyboard.press('Tab');

            // Wait for validation to process
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Check for validation error messages
            try {
                await page.waitForSelector('.v-messages__message', { visible: true, timeout: 2000 });
                const errorMessage = await page.$eval('.v-messages__message', (el) => el.textContent.trim());

                if (errorMessage === "Postal Code is invalid") {
                    console.log(`Error: "${errorMessage}". ZIP code "${postalCodeString}" is invalid.`);
                    return false; // Invalid ZIP code
                }
            } catch (e) {
                // No error message means ZIP code is valid
                console.log(`No error message. ZIP code "${postalCodeString}" is valid.`);
                return true;
            }

            return false; // Default to invalid if an error message is found
        }

        // Function to handle clicking the Cancel button
        async function clickCancelButton() {
            console.log("Clicking the Cancel button...");

            // Wait for the Cancel button to become visible
            await page.waitForSelector('button.v-btn.v-btn--text.theme--light.v-size--default.primary--text', { visible: true });

            // Ensure the Cancel button is within view (scroll if needed)
            await page.evaluate(() => {
                const cancelButton = Array.from(document.querySelectorAll('button.v-btn.v-btn--text.theme--light.v-size--default.primary--text span'))
                    .find(span => span.textContent.trim() === "Cancel"); // Find the span with "Cancel" text

                if (cancelButton) {
                    cancelButton.scrollIntoViewIfNeeded(); // Ensure it scrolls into view
                }
            });

            // Click the parent button of the "Cancel" span
            await page.evaluate(() => {
                const cancelButton = Array.from(document.querySelectorAll('button.v-btn.v-btn--text.theme--light.v-size--default.primary--text'))
                    .find(btn => btn.textContent.trim().includes("Cancel")); // Find the button containing "Cancel" text

                if (cancelButton) {
                    cancelButton.click(); // Click the button
                }
            });

            console.log("Cancel button clicked successfully.");

            // Navigate to the jobs page after clicking
            await page.waitForTimeout(2000); // Wait for any transitions
            await page.goto('https://account.get.it/post-ad/job');
        }

        // Function to handle ZIP code validation and retries
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
                    return; // Exit the function after posting
                }
            }

            // If all attempts fail, click the Cancel button
            if (!isValid) {
                console.log(`ZIP code "${postalCode}" is invalid after 3 attempts. Clicking the Cancel button.`);
                await clickCancelButton();
            }
        }

        // Call the function with jobData.postalCode
        await handleZipCodeValidation(jobData.postalCode);


        // Click outside to ensure dropdown closes
        await page.click('body');

        // Function to select employment type from dropdown
        async function selectEmploymentType(jobData) {
            console.log("🔹 Attempting to select employment type:", jobData.employementType);

            // Click on the employment type dropdown
            const employmentInputSelector = '#input-73';
            await page.waitForSelector(employmentInputSelector, { visible: true });
            await page.click(employmentInputSelector);
            console.log("✅ Clicked on employment type dropdown.");

            // Wait for dropdown options to appear
            const dropdownSelector = '.v-list.v-select-list';
            await page.waitForSelector(dropdownSelector, { visible: true });
            console.log("✅ Dropdown is visible, fetching options...");

            // Get all available employment type options
            const options = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.v-list-item .v-list-item__title'))
                    .map(option => option.textContent.trim());
            });

            console.log("🔹 Available options:", options);

            // Check if the provided employment type exists in the dropdown
            const targetEmploymentType = jobData.employementType.trim();
            const matchingOption = options.find(option => option.toLowerCase().includes(targetEmploymentType.toLowerCase()));

            if (!matchingOption) {
                console.log(`❌ Employment type "${targetEmploymentType}" not found in the dropdown. Exiting.`);
                return;
            }

            console.log(`✅ Employment type "${matchingOption}" found. Selecting...`);

            // Click the matched option
            await page.evaluate((target) => {
                const optionElement = Array.from(document.querySelectorAll('.v-list-item .v-list-item__title'))
                    .find(option => option.textContent.trim().toLowerCase().includes(target.toLowerCase()));

                if (optionElement) {
                    optionElement.closest('.v-list-item').click();
                }
            }, targetEmploymentType);

            console.log("✅ Employment type selected successfully.");
        }

        // Call the function with jobData.employementType
        await selectEmploymentType(jobData);

        // Click outside to close the dropdown
        await page.click('body');

        // add salary type
        if (jobData.salaryType === "Salary") {
            await page.click('#input-161');
        } else if (jobData.salaryType === "Salary Range") {
            await page.click('#input-163');
        }
        console.log(`Salary type added: ${jobData.salaryType}`);

        // add salary (from)
        await page.waitForSelector('.v-text-field__slot input[type="number"]');
        await page.type('.v-text-field__slot input[type="number"]', jobData.salaryFrom.toString());


        // add salary (to)
        if (jobData.salaryType === "Salary Range") {
            await page.waitForSelector('[data-test="listingSalarySelector--salaryTo"] input[type="number"]');
            await page.type('[data-test="listingSalarySelector--salaryTo"] input[type="number"]', jobData.salaryTo.toString());

        }

        // // **Wait 5 seconds before selecting dropdown values**
        // console.log("Waiting 5 seconds before selecting Salary Timeframe...");
        // await new Promise(resolve => setTimeout(resolve, 5000));

        // // Add salary timeframe
        // console.log("🔹 Attempting to select salary timeframe:", jobData.salaryTimeframe);

        // // Ensure dropdown is visible before clicking
        // await page.waitForSelector('[data-test="listingSalarySelector--salaryTimeframe"]', { visible: true });
        // await page.click('[data-test="listingSalarySelector--salaryTimeframe"]');
        // console.log("✅ Clicked on salary timeframe dropdown.");

        // // **Wait 5 seconds before selecting dropdown values**
        // console.log("Waiting 5 seconds before appearing Salary Timeframe values...");
        // await new Promise(resolve => setTimeout(resolve, 5000));

        // // Wait for dropdown to appear
        // await page.waitForSelector('[role="listbox"] .v-list-item, .v-menu__content .v-list-item', { visible: true });
        // console.log("✅ Dropdown is visible, fetching options...");

        // // Select option based on text content
        // const timeframeOption = jobData.salaryTimeframe === "Per Year" ? "Per Year" : "Per Hour";

        // await page.evaluate((timeframeOption) => {
        //     const options = Array.from(document.querySelectorAll('[role="listbox"] .v-list-item, .v-menu__content .v-list-item'));
        //     const optionToSelect = options.find(option => option.innerText.includes(timeframeOption));

        //     if (optionToSelect) {
        //         optionToSelect.click();
        //         console.log(`✅ Selected salary timeframe: ${timeframeOption}`);
        //     } else {
        //         console.log("❌ Could not find the desired salary timeframe.");
        //     }
        // }, timeframeOption);

        // // Extra wait for selection to register
        // await page.waitForTimeout(1000);

        // Function to select salary timeframe from dropdown
        // async function selectSalaryTimeframe(jobData) {
        //     console.log("🔹 Attempting to select salary timeframe:", jobData.employementType);

        //     // Click on the salary timeframe dropdown
        //     const timeframeInputSelector = '#input-228'; // Updated selector
        //     await page.waitForSelector(timeframeInputSelector, { visible: true });
        //     await page.click(timeframeInputSelector);
        //     console.log("✅ Clicked on salary timeframe dropdown.");

        //     // Wait for dropdown options to appear
        //     const dropdownSelector = '.v-list.v-select-list'; // This selector remains the same
        //     await page.waitForSelector(dropdownSelector, { visible: true });
        //     console.log("✅ Dropdown is visible, fetching options...");

        //     // Get all available salary timeframe options
        //     const options = await page.evaluate(() => {
        //         return Array.from(document.querySelectorAll('.v-list-item .v-list-item__title'))
        //             .map(option => option.textContent.trim());
        //     });

        //     console.log("🔹 Available options:", options);

        //     // Check if the provided salary timeframe exists in the dropdown
        //     const targetSalaryTimefram = jobData.salaryTimeframe.trim();
        //     const matchingOption = options.find(option => option.toLowerCase().includes(targetSalaryTimefram.toLowerCase()));

        //     if (!matchingOption) {
        //         console.log(`❌ Salary timeframe "${targetSalaryTimefram}" not found in the dropdown. Exiting.`);
        //         return;
        //     }

        //     console.log(`✅ Salary timeframe "${matchingOption}" found. Selecting...`);

        //     // Click the matched option
        //     await page.evaluate((target) => {
        //         const optionElement = Array.from(document.querySelectorAll('.v-list-item .v-list-item__title'))
        //             .find(option => option.textContent.trim().toLowerCase().includes(target.toLowerCase()));

        //         if (optionElement) {
        //             optionElement.closest('.v-list-item').click();
        //         }
        //     }, targetSalaryTimefram);

        //     console.log("✅ Salary timeframe selected successfully.");
        // }

        // Call the function with jobData.salaryTimeframe
        // await selectSalaryTimeframe(jobData);

        // Click outside to close the dropdown
        await page.click('body');

        console.log("Waiting 5 seconds before selecting Currency...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        // add currency
        await page.waitForSelector('div[role="button"][aria-haspopup="listbox"]');
        await page.click('div[role="button"][aria-haspopup="listbox"]');
        await page.waitForSelector('.v-menu__content .v-list-item');
        await page.evaluate((currency) => {
            document.querySelectorAll('.v-menu__content .v-list-item').forEach(item => {
                if (item.innerText.includes(currency)) {
                    item.click();
                }
            });
        }, jobData.currency);

        //     console.log("Waiting 10 seconds before selecting Education Level...");
        //     await new Promise(resolve => setTimeout(resolve, 10000));

        //     // add education level
        //     await page.waitForSelector('div[role="button"][aria-haspopup="listbox"]');
        //     await page.click('div[role="button"][aria-haspopup="listbox"]');
        //     await page.waitForSelector('.v-menu__content .v-list-item');
        //     await page.evaluate((educationLevel) => {
        //         document.querySelectorAll('.v-menu__content .v-list-item').forEach(item => {
        //             if (item.innerText.includes(educationLevel)) {
        //                 item.click();
        //             }
        //         });
        //     }, jobData.educationLevel);

        //     // add experience
        //     await page.waitForSelector('textarea[id="input-83"]');
        //     await page.type('textarea[id="input-83"]', jobData.experience);

        //     // add qualifications
        //     await page.waitForSelector('textarea[id="input-88"]');
        //     await page.type('textarea[id="input-88"]', jobData.qualifications);

        //     // add skills
        //     await page.waitForSelector('textarea[id="input-93"]');
        //     await page.type('textarea[id="input-93"]', jobData.skills);

        //     // add responsibilities
        //     await page.waitForSelector('textarea[id="input-98"]');
        //     await page.type('textarea[id="input-98"]', jobData.responsibilities);

        //     // add job expiry
        //     if (jobData.jobExpire === "Yes") {
        //         await page.click('input[value="true"]');
        //     } else {
        //         await page.click('input[value="false"]');
        //     }

        //     // add application receive
        //     if (jobData.receiveApplications === "URL") {
        //         await page.click('input[value="applicationURL"]');
        //     } else {
        //         await page.click('input[value="notificationEmail"]');
        //     }

        //     // add notification email
        //     await page.waitForSelector('input[id="input-117"]');
        //     await page.type('input[id="input-117"]', jobData.notificationEmail);

        //     // add enhance with chat gpt 
        //     if (jobData.enhanceWithChatGPT === "No") {
        //         await page.click('input[value="false"]');
        //     } else {
        //         await page.click('input[value="true"]');
        //     }

        //     // click post button 
        //     await page.waitForSelector('button[type="submit"]');
        //     await page.click('button[type="submit"]');

        //     console.log("Job posted successfully.");

        //     try {
        //         await page.waitForSelector('#congrats-free-title', { visible: true, timeout: 10000 });
        //         console.log("Success screen detected.");
        //     } catch (error) {
        //         console.log("Success screen not detected.");
        //     }

        //     res.status(200).send("Job posted successfully.");


        // Optional: Wait for 10 seconds using a custom timeout
        await new Promise((resolve) => setTimeout(resolve, 100000));
    } catch (error) {
        console.error("Error executing script:", error);
        res.status(500).send("Error executing script");
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});