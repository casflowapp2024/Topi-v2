import json

with open('n8n/fixed_n8n_scoped_filtered_final.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for node in data.get('nodes', []):
    if node['type'] == '@n8n/n8n-nodes-langchain.toolHttpRequest':
        if 'parameters' in node:
            params = node['parameters']
            if 'url' in params:
                val = params['url']
                # Add slash back if missing
                if 'baseUrl}}' in val and 'baseUrl}}/' not in val:
                    params['url'] = val.replace('baseUrl}}', 'baseUrl}}/')
                    print(f"Corrected URL in {node['name']}: {params['url']}")

with open('n8n/fixed_n8n_scoped_filtered_final.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)
print("done")
