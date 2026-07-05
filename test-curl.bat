curl.exe -s -i -X POST http://localhost:3000/api/ai/analyze -H "Content-Type: application/json" -d "{\"title\":\"test\"}"
curl.exe -s -i -X POST http://localhost:3000/api/ai/analyze -H "Content-Type: application/json" -H "x-admin-token: dev-admin-token" -d "{\"title\":\"Resolución del SAT sobre obligaciones fiscales\",\"summary\":\"Nueva disposición fiscal para contribuyentes.\"}"
