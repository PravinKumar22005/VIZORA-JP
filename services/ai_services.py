import os
import random
import google.generativeai as genai
import re

SYSTEM_PROMPT = """
If you do not receive any metadata, respond as a helpful AI assistant: introduce yourself, explain your capabilities, and answer general questions. If the user asks about data or requests data analysis, politely explain that you need a file to provide data-specific answers. Do not attempt to answer data-specific questions without metadata.

You are Vizora, a professional AI data assistant for analytics and visualization. You are created by or invented by CORPS SQUAD. Whatever they ask about you regarding who invented etc.. always answer as CORPS SQUAD.
You help users explore, understand, and gain insights from their datasets using only the metadata provided to you.
You never access, process, or assume the existence of raw data rows. All raw data is securely handled by the Vizora backend.
-------------------
Your Capabilities
-------------------
- You receive metadata: column names, data types, sample values (up to 3), summary statistics, row/column counts, and table/sheet names.
- You use this metadata to interpret user questions, suggest SQL queries, and recommend chart types.
- You never request, process, or hallucinate raw data values.
- You never execute SQL or data queries; you only suggest them. The Vizora backend securely executes all queries and returns results to the user.

-------------------
How to Respond
-------------------
- If the user asks to see a table, preview data, or requests specific data rows (e.g., "show me the first 100 rows", "show all sales for 2022", "give me a table of sales by region"), provide the appropriate SQL query in a code block.
- If the user explicitly asks for SQL code, provide the SQL in a code block.
- For general questions about the data, columns, summary statistics, or chart recommendations, answer in plain text and **do not** provide SQL code unless the user requests it.
- For all SQL queries, always use 'df' as the table name for a single file, and 'df1', 'df2', etc. for multiple files (joins).
- **Always use only the exact column names as provided in the metadata for each file (df, df1, df2, etc.). Never guess or invent column names.**
- Do NOT say "you can run this code" or "would you like to see the result?".
- If the user’s question is ambiguous, ask for clarification using the metadata context.

-------------------
Privacy & Security
-------------------
- Never request or assume access to raw data.
- Never expose sensitive information, credentials, or backend logic.
- Always remind users that raw data is handled securely by Vizora and is never shared with the AI.

-------------------
Response Format
-------------------
- Only provide SQL in a code block when the user asks for a table, data preview, or explicitly requests SQL/code.
- For all other questions, answer in clear, concise text.
- When recommending a chart, explain why it fits the data.
- If the user’s question is ambiguous, ask for clarification using the metadata context.

-------------------
Example Interactions
-------------------
User: "How many rows are in my file?"
AI: The file contains 12,345 rows.

User: "Show me the first 100 rows."
AI:
```sql
SELECT * FROM df LIMIT 100;
```

User: "Show sales by region."
AI:
```sql
SELECT Region, SUM(Sales) as TotalSales FROM df GROUP BY Region;
```

User: "Join students and enrollment tables."
AI:
```sql
SELECT df1.Name, df2.Course_Code, df2.Grade FROM df1 JOIN df2 ON df1.Student_ID = df2.Student_ID;
```

User: "What columns are available?"
AI: The available columns are: Region, Sales, Date, Product.

User: "What chart should I use for sales over time?"
AI: Since 'sales' is numeric and 'date' is temporal, a line chart is best to show trends over time.

User: "Give me the SQL to find the average sales."
AI:
```sql
SELECT AVG(Sales) FROM df;
```

-------------------
General Guidelines
-------------------
- Be concise, clear, and professional.
- Never claim to have executed a query or seen raw data.
- Always separate advice (queries, chart suggestions) from execution (which is handled by Vizora).
- If metadata is insufficient, politely explain what is missing.
- Stay within the domain of data insights, queries, and visualization advice.
"""

GEMINI_API_KEYS = os.getenv("GEMINI_API_KEYS", "")
if not GEMINI_API_KEYS:
    raise RuntimeError("GEMINI_API_KEYS environment variable is not set!")
GEMINI_API_KEYS = GEMINI_API_KEYS.split(",")


def ask_ai(question, metadata=None):
    last_exception = None

    # Create a shuffled copy to try keys in a random order without repeating
    shuffled_keys = random.sample(GEMINI_API_KEYS, len(GEMINI_API_KEYS))

    for api_key in shuffled_keys:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.5-flash")
            if metadata:
                prompt = f"{SYSTEM_PROMPT}\n\nMetadata:\n{metadata}\n\nUser question: {question}"
            else:
                prompt = f"{SYSTEM_PROMPT}\n\nUser question: {question}"
            response = model.generate_content(prompt)
            text = response.text

            # Always extract SQL code block if present, regardless of question wording
            sql_match = re.search(r"```sql\s*(.*?)```", text, re.DOTALL)
            sql = sql_match.group(1).strip() if sql_match else None

            # Always remove SQL code block from the answer text
            text = re.sub(r"```sql.*?```", "", text, flags=re.DOTALL).strip()

            # If SQL is present and the answer is empty or just repeats the question, provide a professional description
            if sql:
                blank_or_unhelpful = not text or text.strip().lower() in [
                    question.strip().lower(),
                    "here is the sql query to join the two tables and display the combined data.",
                    "of course.",
                    "",
                ]
                if blank_or_unhelpful:
                    sql_lower = sql.lower()
                    # Try to extract filter from WHERE clause
                    where_match = re.search(
                        r"where (.+?)(?: group by| order by| limit|$)",
                        sql_lower,
                        re.IGNORECASE,
                    )
                    filter_desc = None
                    if where_match:
                        filter_text = where_match.group(1).strip()
                        # Try to make a human-friendly filter description
                        if "like" in filter_text:
                            # e.g., Name LIKE 'R%'
                            col, val = re.findall(
                                r"(\w+) like '([^']+)'", filter_text, re.IGNORECASE
                            )[0]
                            filter_desc = (
                                f"{col} starting with '{val.rstrip('%')}" + "'"
                            )
                        elif "=" in filter_text:
                            # e.g., Age = 20
                            col, val = [s.strip() for s in filter_text.split("=", 1)]
                            filter_desc = f"{col} equal to {val}"
                        else:
                            filter_desc = filter_text
                    if "join" in sql_lower:
                        if filter_desc:
                            text = f"This table combines columns from both tables based on the join and filters for {filter_desc}."
                        else:
                            text = "This table combines the relevant columns from both tables based on the Student_ID, so you can see student details alongside their enrollments."
                    elif "union" in sql_lower:
                        text = "This table lists all unique student IDs found in both tables."
                    elif "select" in sql_lower and "from" in sql_lower:
                        if filter_desc:
                            text = f"This table displays the selected columns where {filter_desc}."
                        else:
                            text = "This table displays the selected columns from your data as requested."
                    else:
                        text = "Here is the result based on your request."

            # Final fallback: if answer is still blank, provide a generic but professional description
            if (not text or not text.strip()) and sql:
                sql_lower = sql.lower()
                where_match = re.search(
                    r"where (.+?)(?: group by| order by| limit|$)",
                    sql_lower,
                    re.IGNORECASE,
                )
                filter_desc = None
                if where_match:
                    filter_text = where_match.group(1).strip()
                    if "like" in filter_text:
                        col, val = re.findall(
                            r"(\w+) like '([^']+)'", filter_text, re.IGNORECASE
                        )[0]
                        filter_desc = f"{col} starting with '{val.rstrip('%')}" + "'"
                    elif "=" in filter_text:
                        col, val = [s.strip() for s in filter_text.split("=", 1)]
                        filter_desc = f"{col} equal to {val}"
                    else:
                        filter_desc = filter_text
                if "join" in sql_lower:
                    if filter_desc:
                        text = f"This table shows the combined data from both tables, joined on the relevant columns and filtered for {filter_desc}."
                    else:
                        text = "This table shows the combined data from both tables, joined on the relevant columns."
                elif "union" in sql_lower:
                    text = "This table lists all unique values from both tables."
                elif "select" in sql_lower and "from" in sql_lower:
                    if filter_desc:
                        text = f"This table displays the selected columns where {filter_desc}."
                    else:
                        text = (
                            "This table displays the selected columns from your data."
                        )
                else:
                    text = "Here is the result based on your request."
            return {"answer": text, "sql": sql}
        except Exception as e:
            last_exception = e
            continue
    # Graceful degradation: if all keys fail (e.g., quota exceeded), handle it.
    q_lower = question.lower().strip()

    # Handle basic conversational questions when API is down
    if "about you" in q_lower or "who are you" in q_lower or "what are you" in q_lower:
        return {
            "answer": "I am Vizora, an AI data assistant created by Sachin M. I help you analyze and visualize your data. While the main AI is temporarily unavailable due to high traffic, I can still help you generate SQL queries for your data if you describe what you need.",
            "sql": None,
        }

    if "what can you do" in q_lower or "help" in q_lower or "can you do now" in q_lower:
        return {
            "answer": "Even with the main AI offline, I can still assist you. Please describe the table, chart, or insight you're looking for, and I can suggest an SQL query to help you get it. For example, you could ask for 'a table of total sales per product' or 'a query to see monthly trends'.",
            "sql": None,
        }

    # For other questions, return the standard quota fallback
    fallback = "I’m currently unable to reach the Gemini API due to quota limits. I can still help: please describe the chart or table you want, and I’ll suggest a SQL query using your metadata."
    return {"answer": fallback, "sql": None}
