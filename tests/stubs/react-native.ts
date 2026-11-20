// The little of react-native the logic files use.
export const Platform = { OS: 'web', select: <T>(o: { web?: T; default?: T }) => o.web ?? o.default };
