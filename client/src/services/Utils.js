// Utils.js
export const isUPC = (str) => {
    const upcPattern = /^\d{11,13}$/;
    return upcPattern.test(str);
};
