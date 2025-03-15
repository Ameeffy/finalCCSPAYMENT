const { Dropbox } = require('dropbox');
const fetch = require('isomorphic-fetch');

// **Dropbox Credentials**
const DROPBOX_APP_KEY = 'rzv1zs8peqg6vk6';
const DROPBOX_APP_SECRET = 'ar2h5oqm72tf3ew';
const DROPBOX_REFRESH_TOKEN = 'oJ1qUsimh0oAAAAAAAAAAeHEHJ2Cr_Mp6HbMRmIFqdWzcfXrPCzcVJxAWMH5qCbx'; // **Replace with your refresh token**

async function getAccessToken() {
    try {
        const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: DROPBOX_REFRESH_TOKEN,
                client_id: DROPBOX_APP_KEY,
                client_secret: DROPBOX_APP_SECRET
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(`Error fetching access token: ${data.error}`);

        return data.access_token;
    } catch (error) {
        console.error('Error refreshing Dropbox token:', error);
        return null;
    }
}

// **Initialize Dropbox with Auto-Refreshing Access Token**
async function initializeDropbox() {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        console.error('Failed to get Dropbox access token');
        return null;
    }

    return new Dropbox({
        accessToken,
        fetch
    });
}

module.exports = { initializeDropbox };
