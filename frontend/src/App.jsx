/* eslint-disable no-unused-vars */
"use client";
import * as React from "react";
import * as XLSX from "xlsx";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { XIcon } from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormDescription,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Validation Schema
const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is mandatory" }),
  accountName: z.string().min(1, { message: "Account name is mandatory" }),
  expiryOption: z.enum(["yes", "no"]).default("no"),
  file: z.instanceof(File).optional(),
  validZipcodes: z
    .string()
    .min(1, { message: "Enter at least one valid zipcode" }),
  invalidZipcodes: z.string(),
});

export default function App() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      accountName: "",
      expiryOption: "no",
      file: undefined,
      validZipcodes: "",
      invalidZipcodes: "",
    },
  });
  const fileInputRef = React.useRef(null);

  const processExcel = (data) => {
    let valid = [];
    let invalid = [];
    // Find column with "Zipcode"
    const zipColumn = Object.keys(data[0]).find((key) =>
      key.toLowerCase().includes("zipcode")
    );
    if (!zipColumn) return { valid: [], invalid: [] };
    data.forEach((row) => {
      const zip = row[zipColumn]?.toString().trim();
      if (/^\d{5}$/.test(zip)) {
        valid.push(zip);
      } else {
        invalid.push(zip);
      }
    });

    return { valid, invalid };
  };

  const onSubmit = async (values) => {
    const requestData = {
      username: values.email,
      password: values.password,
      accountName: values.accountName,
      expiryOption: values.expiryOption == "yes" ? true : false,
      zipcodesList: values.validZipcodes,
    };

    console.log("Formatted Request Data:", requestData);

    try {
      const response = await fetch("http://localhost:3000/repost-job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();
      console.log("API Response:", data);
      alert("Data submitted successfully!");
    } catch (error) {
      console.log("API Error:", error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <Card className="w-full max-w-md bg-white shadow-2xl rounded-lg border border-gray-300">
        <CardHeader className={"text-center text-xl sm:text-3xl"}>
          <CardTitle>Bot For Reposting Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              {/* <FormField
                control={form.control}
                name="email"
                autocomplete="email"
                type="email"
                id="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="example@mail.com"
                        {...field}
                        className="bg-white text-black border-gray-300 focus:border-black focus:ring-black"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="example@mail.com"
                        autoComplete="email"
                        {...field}
                        className="bg-white text-black border-gray-300 focus:border-black focus:ring-black"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        {...field}
                        className="bg-white text-black border-gray-300 focus:border-black focus:ring-black"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Account Name */}
              <FormField
                control={form.control}
                name="accountName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black">Account Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your account name"
                        {...field}
                        onChange={(e) => {
                          const formattedValue = e.target.value
                            .toLowerCase()
                            .replace(/\s+/g, "-");
                          field.onChange(formattedValue);
                        }}
                        className="bg-white text-black border-gray-300 focus:border-black focus:ring-black"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* {Expiry Date} */}
              <FormField
                control={form.control}
                name="expiryOption"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="text-black">
                      Expiration Option
                    </FormLabel>
                    <div className="flex items-center space-x-4">
                      {/* No Option (Default Selected) */}
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="no"
                          checked={field.value === "no"}
                          onChange={() => field.onChange("no")}
                          className="form-radio text-black"
                        />
                        <span>No</span>
                      </label>

                      {/* Yes Option */}
                      <label className="flex items-center space-x-2">
                        <input
                          value="yes"
                          type="radio"
                          checked={field.value === "yes"}
                          onChange={() => field.onChange("yes")}
                          className="form-radio text-black"
                        />
                        <span>Yes</span>
                      </label>
                    </div>

                    {/* Expiration Message */}
                    {field.value === "yes" && (
                      <p className="mt-2 text-sm text-gray-600">
                        Post(s) will expire after one month.
                      </p>
                    )}
                  </FormItem>
                )}
              />

              {/* Choose File */}
              <FormField
                control={form.control}
                name="file"
                render={({ field: { onChange, ...field } }) => (
                  <FormItem className="text-black">
                    <FormLabel className="text-black">Upload File</FormLabel>
                    <div className="flex items-center space-x-2">
                      <FormControl>
                        <Input
                          ref={fileInputRef} // ✅ Attach ref here
                          className="w-[90%]"
                          type="file"
                          accept=".xls,.xlsx,.csv"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            onChange(file); // ✅ Store in form state

                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const data = new Uint8Array(
                                  event.target.result
                                );
                                const workbook = XLSX.read(data, {
                                  type: "array",
                                });

                                const sheetName = workbook.SheetNames[0];
                                const sheet = workbook.Sheets[sheetName];

                                const jsonData =
                                  XLSX.utils.sheet_to_json(sheet);

                                const { valid, invalid } =
                                  processExcel(jsonData);

                                form.setValue(
                                  "validZipcodes",
                                  valid.join(", ")
                                );
                                form.setValue(
                                  "invalidZipcodes",
                                  invalid.join(", "),
                                  {
                                    shouldValidate: true,
                                  }
                                );
                              };

                              reader.readAsArrayBuffer(file);
                            }
                          }}
                        />
                      </FormControl>

                      {/* X Button to Reset File */}
                      {field.value && (
                        <button
                          type="button"
                          className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition"
                          onClick={() => {
                            onChange(null); // ✅ Clear form state
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ""; // ✅ Reset input field
                              form.setValue("validZipcodes", "");
                            }
                          }}
                        >
                          <XIcon className="h-4 w-4 text-gray-600" />
                        </button>
                      )}
                    </div>
                  </FormItem>
                )}
              />

              {/* Valid Zipcodes */}
              <FormField
                control={form.control}
                name="validZipcodes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black">Valid Zipcodes</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="96146, 96150"
                        {...field}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, ""); // Remove non-numeric characters
                          let formattedValue =
                            value
                              .match(/.{1,5}/g) // Split into chunks of 5 digits
                              ?.join(", ") || ""; // Join chunks with ", "

                          field.onChange(formattedValue);
                        }}
                        className="bg-white text-black border-gray-300 focus:border-black focus:ring-black"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Invalid Zipcodes (Disabled) */}
              <FormField
                control={form.control}
                name="invalidZipcodes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black">
                      Invalid Zipcodes
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="abc12, 34xyz, !@#$%"
                        {...field}
                        readOnly
                        className="bg-gray-200 text-gray-500 border-gray-300"
                      />
                      {/* <span>{form.control}</span> */}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-black text-white hover:bg-gray-900"
              >
                Submit
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
