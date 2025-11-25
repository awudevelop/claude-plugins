Debug: {{DESCRIBE_BUG}}

  **Context:**
  - Action: {{WHAT_YOU_DID}}
  - Expected: {{EXPECTED_RESULT}}
  - Actual: {{ACTUAL_RESULT}}

  **Analysis Steps:**

  1. Read network requests (filter: API calls in last 60 seconds)
  2. Read console errors (if available)
  3. Identify failed requests (status >= 400) or missing requests
  4. For failed requests: validate payload against expected schema
  5. Apply decision tree:
  - No API call → FRONTEND (handler issue)
  - API call + no error → FRONTEND (state/UI issue)
  - API call + error + invalid payload → FRONTEND (payload issue)
  - API call + error + valid payload → BACKEND (server issue)

  **Output (JSON):**
  ```json
  {
    "category": "FRONTEND | BACKEND",
    "rootCause": "Specific issue",
    "evidence": {
   "apiCalls": [],
   "failedRequest": {},
   "payloadAnalysis": {},
   "consoleErrors": []
    },
    "fix": {
   "location": "File/component",
   "action": "What to change",
   "code": "Example fix"
    }
  }