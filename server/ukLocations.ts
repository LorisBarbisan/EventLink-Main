// Pre-loaded common UK locations for instant search results
export const commonUKLocations = [
  // Major Cities
  { name: "London", county: "Greater London", postcode: "", type: "city" },
  { name: "Birmingham", county: "West Midlands", postcode: "", type: "city" },
  { name: "Manchester", county: "Greater Manchester", postcode: "", type: "city" },
  { name: "Liverpool", county: "Merseyside", postcode: "", type: "city" },
  { name: "Leeds", county: "West Yorkshire", postcode: "", type: "city" },
  { name: "Sheffield", county: "South Yorkshire", postcode: "", type: "city" },
  { name: "Bristol", county: "Bristol", postcode: "", type: "city" },
  { name: "Newcastle", county: "Tyne and Wear", postcode: "", type: "city" },
  { name: "Nottingham", county: "Nottinghamshire", postcode: "", type: "city" },
  { name: "Leicester", county: "Leicestershire", postcode: "", type: "city" },
  
  // London Boroughs
  { name: "Westminster", county: "Greater London", postcode: "", type: "borough" },
  { name: "Camden", county: "Greater London", postcode: "", type: "borough" },
  { name: "Islington", county: "Greater London", postcode: "", type: "borough" },
  { name: "Hackney", county: "Greater London", postcode: "", type: "borough" },
  { name: "Tower Hamlets", county: "Greater London", postcode: "", type: "borough" },
  { name: "Greenwich", county: "Greater London", postcode: "", type: "borough" },
  { name: "Southwark", county: "Greater London", postcode: "", type: "borough" },
  { name: "Lambeth", county: "Greater London", postcode: "", type: "borough" },
  { name: "Wandsworth", county: "Greater London", postcode: "", type: "borough" },
  { name: "Hammersmith and Fulham", county: "Greater London", postcode: "", type: "borough" },
  { name: "Kensington and Chelsea", county: "Greater London", postcode: "", type: "borough" },
  { name: "Chelsea", county: "Greater London", postcode: "", type: "area" },
  { name: "Shoreditch", county: "Greater London", postcode: "", type: "area" },
  { name: "Canary Wharf", county: "Greater London", postcode: "", type: "area" },
  
  // Major Towns
  { name: "Reading", county: "Berkshire", postcode: "", type: "town" },
  { name: "Oxford", county: "Oxfordshire", postcode: "", type: "city" },
  { name: "Cambridge", county: "Cambridgeshire", postcode: "", type: "city" },
  { name: "Brighton", county: "East Sussex", postcode: "", type: "city" },
  { name: "Bath", county: "Somerset", postcode: "", type: "city" },
  { name: "York", county: "North Yorkshire", postcode: "", type: "city" },
  { name: "Canterbury", county: "Kent", postcode: "", type: "city" },
  { name: "Exeter", county: "Devon", postcode: "", type: "city" },
  { name: "Plymouth", county: "Devon", postcode: "", type: "city" },
  { name: "Southampton", county: "Hampshire", postcode: "", type: "city" },
  { name: "Portsmouth", county: "Hampshire", postcode: "", type: "city" },
  { name: "Bournemouth", county: "Dorset", postcode: "", type: "town" },
  { name: "Luton", county: "Bedfordshire", postcode: "", type: "town" },
  { name: "Milton Keynes", county: "Buckinghamshire", postcode: "", type: "town" },
  { name: "Swindon", county: "Wiltshire", postcode: "", type: "town" },
  { name: "Northampton", county: "Northamptonshire", postcode: "", type: "town" },
  { name: "Norwich", county: "Norfolk", postcode: "", type: "city" },
  { name: "Ipswich", county: "Suffolk", postcode: "", type: "town" },
  { name: "Colchester", county: "Essex", postcode: "", type: "town" },
  { name: "Chelmsford", county: "Essex", postcode: "", type: "city" },
  { name: "St Albans", county: "Hertfordshire", postcode: "", type: "city" },
  { name: "Watford", county: "Hertfordshire", postcode: "", type: "town" },
  { name: "Stevenage", county: "Hertfordshire", postcode: "", type: "town" },
  { name: "Harlow", county: "Essex", postcode: "", type: "town" },
  
  // Scotland
  { name: "Edinburgh", county: "Scotland", postcode: "", type: "city" },
  { name: "Glasgow", county: "Scotland", postcode: "", type: "city" },
  { name: "Aberdeen", county: "Scotland", postcode: "", type: "city" },
  { name: "Dundee", county: "Scotland", postcode: "", type: "city" },
  { name: "Stirling", county: "Scotland", postcode: "", type: "city" },
  
  // Wales
  { name: "Cardiff", county: "Wales", postcode: "", type: "city" },
  { name: "Swansea", county: "Wales", postcode: "", type: "city" },
  { name: "Newport", county: "Wales", postcode: "", type: "city" },
  { name: "Wrexham", county: "Wales", postcode: "", type: "town" },
  
  // Northern Ireland
  { name: "Belfast", county: "Northern Ireland", postcode: "", type: "city" },
  { name: "Derry", county: "Northern Ireland", postcode: "", type: "city" },
  { name: "Lisburn", county: "Northern Ireland", postcode: "", type: "city" },
  
  // Event Industry Locations
  { name: "Olympia", county: "Greater London", postcode: "", type: "venue" },
  { name: "ExCeL London", county: "Greater London", postcode: "", type: "venue" },
  { name: "NEC Birmingham", county: "West Midlands", postcode: "", type: "venue" },
  { name: "Manchester Central", county: "Greater Manchester", postcode: "", type: "venue" },
  { name: "SEC Glasgow", county: "Scotland", postcode: "", type: "venue" },
];

export function searchLocalLocations(query: string, limit: number = 8) {
  if (!query || query.length < 2) return [];
  
  const searchTerm = query.toLowerCase().trim();
  const results = [];
  
  // Exact matches first
  for (const location of commonUKLocations) {
    if (location.name.toLowerCase() === searchTerm) {
      results.push({
        name: location.name,
        county: location.county,
        formatted: location.county ? `${location.name}, ${location.county}` : location.name,
        type: location.type
      });
    }
  }
  
  // Starts with matches
  for (const location of commonUKLocations) {
    if (location.name.toLowerCase().startsWith(searchTerm) && 
        !results.some(r => r.name === location.name)) {
      results.push({
        name: location.name,
        county: location.county,
        formatted: location.county ? `${location.name}, ${location.county}` : location.name,
        type: location.type
      });
    }
  }
  
  // Contains matches
  for (const location of commonUKLocations) {
    if (location.name.toLowerCase().includes(searchTerm) && 
        !results.some(r => r.name === location.name)) {
      results.push({
        name: location.name,
        county: location.county,
        formatted: location.county ? `${location.name}, ${location.county}` : location.name,
        type: location.type
      });
    }
  }
  
  return results.slice(0, limit);
}

// UK Postcode validation
export function validateUKPostcode(postcode: string): boolean {
  const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;
  return ukPostcodeRegex.test(postcode.trim());
}

export function formatUKPostcode(postcode: string): string {
  const cleaned = postcode.replace(/\s/g, '').toUpperCase();
  if (cleaned.length === 6) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  } else if (cleaned.length === 7) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  }
  return postcode;
}