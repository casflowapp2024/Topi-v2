import json

with open('n8n/current_workflow_filtered_strict.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for node in data.get('nodes', []):
    if node['name'] == 'No4_transacciones':
        if 'parameters' in node:
            params = node['parameters']
            
            # The LLM is now outputting a JSON object disguised as a string inside "query":
            # "query": "{\"skip\":0, \"limit\":10}"
            # So, {{$parameter.query}} in the URL creates an invalid URL: /list{"skip":0}
            
            # Revert the URL to clean path without appending the query string
            # Also, notice in the screenshot the LLM now sends "query" parameter, so let's parse it
            if '{{$parameter.query}}' in params.get('url', ''):
                params['url'] = params['url'].replace('{{$parameter.query}}', '')
            
            # Enable Send Query Parameters and 'Using JSON' option
            params['sendQuery'] = True
            params['specifyQuery'] = 'json'
            
            # Now we use the parameter parametrised JSON as the source of our JSON parameters to send in the GET Request
            # N8N's jsonQuery needs the raw text of the JSON which will be evaluated
            params['jsonQuery'] = "={{$parameter.query}}" 

with open('n8n/current_workflow_filtered_strict.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print('Updated current_workflow: Switched back to JSON Body for Query parameters parsing.')
