import { v4 as uuid } from 'uuid';
import { WebSocket, Server } from 'mock-socket';

declare global {
	interface Window {
		mockServer: Server;
		mockSocket: WebSocket;
	}
}

const mocks: { [key: string]: { server: Server; websocket: WebSocket } } = {};

const cleanupMock = (url: string) => {
	if (mocks[url]) {
		mocks[url].websocket.close();
		mocks[url].server.stop();
		delete mocks[url];
	}
};

const createMock = (url: string) => {
	cleanupMock(url);
	const server = new Server(url);
	const websocket = new WebSocket(url);
	mocks[url] = { server, websocket };

	return mocks[url];
};

export const mockWebSocketV2 = () => {
	cy.on('window:before:load', (win) => {
		const winWebSocket = win.WebSocket;
		cy.stub(win, 'WebSocket').callsFake((url) => {
			console.log(url);
			if ((new URL(url).pathname.indexOf('/sockjs-node/') !== 0)) {
				const { server, websocket } = createMock(url);

				win.mockServer = server;
				win.mockServer.on('connection', (socket) => {
					win.mockSocket = socket;
				});

				win.mockServer.on('message', (message) => {
					console.log(message);
				});

				return websocket;
			} else {
				return new winWebSocket(url);
			}
		});
	});

	cy.on('window:before:unload', () => {
		for (const url in mocks) {
			cleanupMock(url);
		}
	});
};

export const mockWebSocket = () => {
	cy.on('window:before:load', (win) => {
		const winWebSocket = win.WebSocket;
		cy.stub(win, 'WebSocket').callsFake((url) => {
			console.log(url);
			if ((new URL(url).pathname.indexOf('/sockjs-node/') !== 0)) {
				const { server, websocket } = createMock(url);

				win.mockServer = server;
				win.mockServer.on('connection', (socket) => {
					win.mockSocket = socket;
					win.mockSocket.send('{"conversions":{"USD":32365.338815782445}}');
					cy.readFile('cypress/fixtures/mainnet_live2hchart.json', 'ascii').then((fixture) => {
						win.mockSocket.send(JSON.stringify(fixture));
					});
					cy.readFile('cypress/fixtures/mainnet_mempoolInfo.json', 'ascii').then((fixture) => {
						win.mockSocket.send(JSON.stringify(fixture));
					});
				});

				win.mockServer.on('message', (message) => {
					console.log(message);
				});

				return websocket;
			} else {
				return new winWebSocket(url);
			}
		});
	});

	cy.on('window:before:unload', () => {
		for (const url in mocks) {
			cleanupMock(url);
		}
	});
};

export const receiveWebSocketMessageFromServer = ({
	params
}: { params?: any } = {}) => {
	cy.window().then((win) => {
		if (params.message) {
			console.log('sending message');
			win.mockSocket.send(params.message.contents);
		}

		if (params.file) {
			cy.readFile(`cypress/fixtures/${params.file.path}`, 'utf-8').then((fixture) => {
				console.log('sending payload');
				win.mockSocket.send(JSON.stringify(fixture));
			});

		}
	});
	return;
};


export const emitMempoolInfo = ({
	params
}: { params?: any } = {}) => {
	cy.window().then((win) => {
		// Determine the network prefix, default to 'mainnet'
		let networkPrefix = 'mainnet';
		if (params?.network && ['mainnet', 'testnet', 'signet'].includes(params.network)) {
			networkPrefix = params.network;
		} else {
			// Optionally log a warning if an unexpected network is provided
			console.warn(`Unexpected or missing network parameter: ${params?.network}. Defaulting to 'mainnet'.`);
		}

		switch (params.command) {
			case "init": {
				// Send initial conversion rate (assuming this might not be network specific, or handle separately if needed)
				win.mockSocket.send('{\"conversions\":{\"USD\":32365.338815782445}}');

				// Load network-specific live chart data
				const liveChartFixturePath = `cypress/fixtures/${networkPrefix}_live2hchart.json`;
				cy.readFile(liveChartFixturePath, 'utf-8').then((fixture) => {
					win.mockSocket.send(JSON.stringify(fixture));
				}).catch((err) => {
					console.error(`Error reading fixture ${liveChartFixturePath}:`, err);
					// Handle error appropriately, maybe send a default response or fail the test
				});

				// Load network-specific mempool info
				const mempoolInfoFixturePath = `cypress/fixtures/${networkPrefix}_mempoolInfo.json`;
				cy.readFile(mempoolInfoFixturePath, 'utf-8').then((fixture) => {
					win.mockSocket.send(JSON.stringify(fixture));
				}).catch((err) => {
					console.error(`Error reading fixture ${mempoolInfoFixturePath}:`, err);
					// Handle error appropriately
				});
				break;
			}
			case "rbfTransaction": {
				// Load network-specific RBF data
				const rbfFixturePath = `cypress/fixtures/${networkPrefix}_rbf.json`;
				cy.readFile(rbfFixturePath, 'utf-8').then((fixture) => {
					win.mockSocket.send(JSON.stringify(fixture));
				}).catch((err) => {
					console.error(`Error reading fixture ${rbfFixturePath}:`, err);
					// Handle error appropriately
				});
				break;
			}
			case 'trackTx': {
				// Assuming trackTx might be network-agnostic or needs specific handling
				// If network specific, construct path like: `cypress/fixtures/${networkPrefix}_track_tx.json`
				cy.readFile('cypress/fixtures/track_tx.json', 'utf-8').then((fixture) => {
					win.mockSocket.send(JSON.stringify(fixture));
				}).catch((err) => {
					console.error(`Error reading fixture cypress/fixtures/track_tx.json:`, err);
					// Handle error appropriately
				});
				break;
			}
			default:
				console.warn(`Unknown command: ${params.command}`);
				break;
		}
	});
    cy.waitForSkeletonGone();
    return cy.get('#mempool-block-0');
};

export const dropWebSocket = (() => {
    cy.window().then((win) => {
        win.mockServer.simulate("error");
    });
    return cy.wait(500);
});
