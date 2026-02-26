const ipInput = document.getElementById('ip-input') as HTMLInputElement;
const lookupBtn = document.getElementById('lookup-btn') as HTMLButtonElement;
const errorMessage = document.getElementById('error-message') as HTMLDivElement;
const resultsContainer = document.getElementById('results-container') as HTMLDivElement;
const resultsList = document.getElementById('results-list') as HTMLUListElement;
const copyAllBtn = document.getElementById('copy-all-btn') as HTMLButtonElement;

// Mock data generators
const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const streetNames = ['Main St', 'Oak St', 'Pine St', 'Maple Ave', 'Cedar Ln', 'Elm St', 'Washington Blvd', 'Lakeview Dr', 'Hillcrest Rd', 'Park Ave'];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockData() {
  const firstName = getRandomItem(firstNames);
  const lastName = getRandomItem(lastNames);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}@example.com`;
  const street = `${Math.floor(Math.random() * 9000) + 100} ${getRandomItem(streetNames)}`;
  const phone = `555-${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

  return { firstName, lastName, email, street, phone };
}

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return false;
    const num = parseInt(part, 10);
    if (num < 0 || num > 255) return false;
    if (part.length > 1 && part.startsWith('0')) return false;
  }
  
  return true;
}

function showError(msg: string) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove('hidden');
  resultsContainer.classList.add('hidden');
}

function hideError() {
  errorMessage.classList.add('hidden');
}

async function performLookup() {
  const ip = ipInput.value.trim();
  
  if (!ip || !isValidIPv4(ip)) {
    showError('Invalid IPv4 format. Example: 192.168.1.1');
    return;
  }
  
  hideError();
  lookupBtn.disabled = true;
  lookupBtn.textContent = 'Looking up...';
  
  try {
    let data: any = null;
    let apiSuccess = false;
    let isRateLimited = false;

    // 1. Try ipapi.co
    try {
      const response = await fetch(`https://ipapi.co/${ip}/json/`);
      const responseData = await response.json().catch(() => ({}));
      
      if (response.status === 429 || responseData.reason === 'RateLimited') {
        isRateLimited = true;
        throw new Error('Rate limit');
      }
      
      if (response.ok && !responseData.error) {
        data = responseData;
        apiSuccess = true;
      } else if (responseData.reason === 'Reserved IP Address' || responseData.message?.includes('Reserved')) {
        data = {};
        apiSuccess = true;
      } else {
        throw new Error('ipapi.co failed');
      }
    } catch (err: any) {
      if (err.message === 'Rate limit') isRateLimited = true;
    }
      
    // 2. Try ipwho.is if ipapi.co failed
    if (!apiSuccess) {
      try {
        const fallbackResponse = await fetch(`https://ipwho.is/${ip}`);
        const fallbackData = await fallbackResponse.json().catch(() => ({}));
        
        if (fallbackData.success) {
          data = {
            postal: fallbackData.postal,
            city: fallbackData.city,
            region: fallbackData.region,
            country_name: fallbackData.country,
            org: fallbackData.connection?.org || fallbackData.connection?.isp,
            timezone: fallbackData.timezone?.id
          };
          apiSuccess = true;
        } else if (fallbackData.message?.includes('Reserved') || fallbackData.message?.includes('Private')) {
          data = {};
          apiSuccess = true;
        } else if (fallbackData.message?.toLowerCase().includes('limit')) {
          isRateLimited = true;
          throw new Error('Rate limit');
        } else {
          throw new Error('ipwho.is failed');
        }
      } catch (fallbackErr: any) {
        if (fallbackErr.message === 'Rate limit') isRateLimited = true;
        
        // 3. Try ipinfo.io as last resort
        if (!apiSuccess) {
          try {
            const fallback2Response = await fetch(`https://ipinfo.io/${ip}/json`);
            const fallback2Data = await fallback2Response.json().catch(() => ({}));
            
            if (fallback2Response.status === 429 || fallback2Data.error?.title === 'Rate limit exceeded') {
              isRateLimited = true;
              throw new Error('Rate limit');
            }
            
            if (fallback2Response.ok && fallback2Data.ip) {
              data = {
                postal: fallback2Data.postal,
                city: fallback2Data.city,
                region: fallback2Data.region,
                country_name: fallback2Data.country,
                org: fallback2Data.org,
                timezone: fallback2Data.timezone
              };
              apiSuccess = true;
            } else if (fallback2Data.bogon) {
              data = {};
              apiSuccess = true;
            } else {
              throw new Error('ipinfo.io failed');
            }
          } catch (fallback2Err: any) {
            if (fallback2Err.message === 'Rate limit') isRateLimited = true;
          }
        }
      }
    }

    if (!apiSuccess) {
      throw new Error(isRateLimited ? 'Rate limit' : 'API failure');
    }
    
    const mockData = generateMockData();
    displayResults(data, mockData);
  } catch (error: any) {
    if (error.message === 'Rate limit') {
      showError('Rate limit exceeded. Please try again later.');
    } else if (!navigator.onLine) {
      showError('No internet connection. Please check your network.');
    } else {
      showError('Could not retrieve data. Check connection / API.');
    }
  } finally {
    lookupBtn.disabled = false;
    lookupBtn.textContent = 'Lookup';
  }
}

function displayResults(apiData: any, mockData: any) {
  resultsList.innerHTML = '';
  
  const fields = [
    { label: 'First Name', value: mockData.firstName },
    { label: 'Last Name', value: mockData.lastName },
    { label: 'Email', value: mockData.email },
    { label: 'Street', value: mockData.street },
    { label: 'Postal Code', value: apiData.postal || 'Not Available' },
    { label: 'City', value: apiData.city || 'Not Available' },
    { label: 'State / Region', value: apiData.region || 'Not Available' },
    { label: 'Country', value: apiData.country_name || 'Not Available' },
    { label: 'ISP / Organization', value: apiData.org || 'Not Available' },
    { label: 'Timezone', value: apiData.timezone || 'Not Available' },
    { label: 'Phone', value: mockData.phone }
  ];
  
  fields.forEach(field => {
    const li = document.createElement('li');
    li.className = 'result-item';
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'result-label';
    labelSpan.textContent = `${field.label}:`;
    
    const valueSpan = document.createElement('span');
    valueSpan.className = 'result-value';
    valueSpan.textContent = field.value;
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(field.value).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.classList.remove('copied');
        }, 2000);
      }).catch(() => {
        // Ignore error
      });
    });
    
    li.appendChild(labelSpan);
    li.appendChild(valueSpan);
    li.appendChild(copyBtn);
    
    resultsList.appendChild(li);
  });
  
  resultsContainer.classList.remove('hidden');
}

lookupBtn.addEventListener('click', performLookup);

ipInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    performLookup();
  }
});

copyAllBtn.addEventListener('click', () => {
  const items = resultsList.querySelectorAll('.result-item');
  let textToCopy = '';
  
  items.forEach(item => {
    const label = item.querySelector('.result-label')?.textContent || '';
    const value = item.querySelector('.result-value')?.textContent || '';
    textToCopy += `${label} ${value}\n`;
  });
  
  navigator.clipboard.writeText(textToCopy.trim()).then(() => {
    const originalText = copyAllBtn.textContent;
    copyAllBtn.textContent = 'Copied All!';
    copyAllBtn.classList.add('copied');
    setTimeout(() => {
      copyAllBtn.textContent = originalText;
      copyAllBtn.classList.remove('copied');
    }, 2000);
  }).catch(() => {
    // Ignore error
  });
});
