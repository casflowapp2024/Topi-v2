import json

with open('n8n/current_workflow.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for node in data.get('nodes', []):
    if node['name'] == 'No4_transacciones':
        if 'parameters' in node:
            params = node['parameters']
            
            # The LLM outputs the query in a single parameter "query"
            if '{{$parameter.query}}' not in params.get('url', ''):
                params['url'] = "={{$json.baseUrl}}/transactions/list{{$parameter.query}}"
            
            # Remove any specific query parameters that cause N8N to try to parse JSON
            keys_to_remove = ['sendQuery', 'specifyQuery', 'jsonQuery', 'parametersQuery']
            for k in keys_to_remove:
                if k in params:
                    del params[k]
                    
with open('n8n/current_workflow.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print('Updated current_workflow to fix No4 parsing error.')
