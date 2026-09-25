import AsyncStorage from "@react-native-async-storage/async-storage";

export const getSavedAddresses = async (userId: string): Promise<any[]> => {
  const json = await AsyncStorage.getItem(`addresses_${userId}`);
  return json ? JSON.parse(json) : [];
};

export const addSavedAddress = async (userId: string, address: any): Promise<void> => {
  const addresses = await getSavedAddresses(userId);
  // Avoid duplicates based on fullName and phone
  const exists = addresses.some(
    (a) => a.fullName === address.fullName && a.phone === address.phone,
  );
  if (!exists) {
    addresses.push(address);
    await AsyncStorage.setItem(`addresses_${userId}`, JSON.stringify(addresses));
  }
};
