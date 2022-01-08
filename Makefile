all: scrape deduplicate geocode geojson

scrape:
	@./run.sh

deduplicate:
	@cat ./data/funda-business.ndjson | jq  -s 'unique_by(.address)' | jq -c -r '.[]' > ./data/funda-business-deduplicated.ndjson

count:
	@wc -l ./data/funda-business-deduplicated.ndjson

geocode:
	@cat ./data/funda-business-deduplicated.ndjson | ../geocoder/geocode.js > ./data/funda-business-geocoded.ndjson

geojson:
	@cat ./data/funda-business-geocoded.ndjson | ../ndjson-to-geojson/ndjson-to-geojson.js > ./data/funda-business.geojson

import:
	@cat ./data/funda-business-geocoded.ndjson | ../import-ndjson/import-ndjson.js -t bovenland.funda -s 3857
