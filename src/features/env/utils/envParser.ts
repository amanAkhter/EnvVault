export const parseEnvString = (envString: string) => {
  const lines = envString.split('\n');
  const result: { key: string; value: string }[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      let key = match[1].trim();
      let value = match[2].trim();

      // Remove wrapping quotes from value
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      
      result.push({ key, value });
    }
  }
  return result;
};
