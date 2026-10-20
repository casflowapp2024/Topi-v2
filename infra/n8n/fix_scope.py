import json

with open('n8n/fixed_n8n_scoped_filtered.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for node in data.get('nodes', []):
    if 'parameters' in node:
        params = node['parameters']
        if 'parametersHeaders' in params and 'values' in params['parametersHeaders']:
            for header in params['parametersHeaders']['values']:
                if header['name'] == 'Authorization':
                    val = header['value']
                    if '$json.first()' in val:
                        header['value'] = val.replace('$json.first()', "$('Set Variables').first()")
                    print(f"Node: {node['name']} -> Fixed: {header['value']}")

with open('n8n/fixed_n8n_scoped_filtered_final.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print('Done fixing!')
