import json

with open('n8n/current_workflow_filtered_strict.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for node in data.get('nodes', []):
    if node['name'] == 'No4_transacciones':
        if 'parameters' in node:
            params = node['parameters']
            
            # Use n8n JSON.parse() syntax so that the parsed object gets read natively
            params['jsonQuery'] = "={{JSON.parse($parameter.query)}}"

with open('n8n/current_workflow_filtered_strict.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print('Updated No4_transacciones jsonQuery config to use JSON.parse() on the parameter.')
