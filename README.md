# Brief description

This is a simplified test app to check the Gitlab endpoints used in [Auth0's Gitlab code deployment automation extension](https://auth0.com/docs/extensions/gitlab-deploy). The intension is to provide a test environment to see if the extension will fail due to some special cases. E.g. private instances of Gitlab with proxies or similar.


# Setup

* Install [Node.js](https://nodejs.org/en/download/) if you haven't already. I've tested with v10.14.2.
* Clone the project to a local repositor.
* > cd ./gitlab-personal-access-token-test
* > npm install
* Update config.js for your Gitlab account.
* > npm start





