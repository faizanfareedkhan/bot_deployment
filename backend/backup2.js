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
    await page.type("#email", "fonol17716@dfesc.com"); // Replace #email with the actual selector
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
      "https://account.get.it/business/crm-specialist/dashboard/listings/jobs?limit=500&page=1&order=created&sort=DESC&state=pending";
    await page.goto(finalUrl, { waitUntil: "load", timeout: 60000 });

    const cookies = await page.cookies();
    // console.log("Cookies:", cookies);

    // Extract job listings from the table
    const jobListings = await page.evaluate(() => {
      let sr = 0; // Define the counter inside the browser context
      const rows = Array.from(document.querySelectorAll("table tbody tr")); // Select all <tr> elements in the table body
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
        await page.click("button.v-btn.v-btn--icon.v-btn--round .v-icon.mdi-dots-vertical");

        // Wait for the dropdown menu to appear
        await page.waitForSelector(".v-menu__content.menuable__content__active.theme--light", { visible: true });

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

        // Optional: Wait for 30 seconds using a custom timeout
        await new Promise((resolve) => setTimeout(resolve, 30000));

        console.log(`Processing job for zipcode: ${zipcode}`);

        // Wait for the job post form to appear with an increased timeout
        await page.waitForSelector('input[data-test="listingFormJob--title"]', {
          timeout: 30000,
        }); // Wait for the job title input field using data-test

        // Define the new title to set in the input field (replace with your desired title)
        const newTitle = `${location} | ${zipcode}`; // Set your title here

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

        const postalCode = zipcode;
        console.log(`Setting postal code: "${postalCode}"`);

        // Wait for the postal code input field to be visible
        await page.waitForSelector('input[data-test="postalCode--input"]', {
          visible: true,
        });

        // Function to check if a ZIP code is valid based on the website's feedback
        async function isZipCodeValid(page) {
          // Check for validation error messages or specific UI indicators
          const errorExists = await page.$("div.error-message"); // Replace with the actual selector for ZIP validation error
          return !errorExists; // If error message exists, ZIP code is invalid
        }

        // Function to enter a postal code and validate it
        async function enterPostalCode(zipCode) {
          const postalCodeString = String(zipCode); // Ensure postalCode is a string

          // Simulate typing the postal code value into the input field
          await page.focus('input[data-test="postalCode--input"]'); // Focus the input
          await page.click('input[data-test="postalCode--input"]', {
            clickCount: 3,
          }); // Select the current value
          await page.keyboard.type(postalCodeString); // Type the new postal code

          console.log(`Attempted to set postal code: "${postalCodeString}"`);

          // Allow time for validation to occur
          await new Promise((resolve) => setTimeout(resolve, 2000)); // 2-second delay

          // Check if the ZIP code is valid
          return await isZipCodeValid(page)
            ;
        }

        // Attempt to set the initial postal code
        let isValid = await enterPostalCode(postalCode);
        if (!isValid) {
          console.log(
            `ZIP code "${postalCode}" is invalid. Using hardcoded ZIP code "10038".`
          );

          // Set hardcoded ZIP code if the initial one is invalid
          const hardcodedZipCode = "10038";
          isValid = await enterPostalCode(hardcodedZipCode);

          if (!isValid) {
            console.error(
              `Hardcoded ZIP code "${hardcodedZipCode}" also failed. Skipping this job.`
            );
            return; // Skip this job if even the hardcoded ZIP code fails
          }

          console.log(
            `Successfully set hardcoded ZIP code: "${hardcodedZipCode}".`
          );
        } else {
          console.log(`ZIP code "${postalCode}" is valid.`);
        }

        // Click outside the input field to finalize the change
        await page.click("body");
        console.log(`Postal code finalized: "${postalCode}".`);

        // Wait for the "Post" button to be visible using the class selector
        await page.waitForSelector("button.v-btn--is-elevated", {
          visible: true,
        });

        // Click the "Post" button
        await page.click("button.v-btn--is-elevated");
        console.log('Clicked the "Post" button.');

        // Wait for 30 seconds using a custom timeout
        await new Promise((resolve) => setTimeout(resolve, 20000));
        
        try {
          // Wait for the anchor tag with aria-label "Manage your jobs"
          await page.waitForSelector('a[aria-label="Manage your jobs"]', {
            visible: true,
          });

          // Click on the "Manage your jobs" button if found
          await page.click('a[aria-label="Manage your jobs"]');
          console.log('Clicked on the "Manage your jobs" button.');
        } catch (error) {
          console.error('"Manage your jobs" button not found.');
          // Handle the absence of the button as needed
        }
      }

      // Using setTimeout for manual delay instead of waitForTimeout
      await new Promise((resolve) => setTimeout(resolve, 600000));
    }

    // Optionally take a screenshot after submission
    // await page.screenshot({ path: 'form-filled.png' });
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    // Close the browser
    // await browser.close();
  }
})();