import { createSlice } from "@reduxjs/toolkit";

const filterSlice = createSlice({
  name: "filter",
  initialState: {
    category: "Все", // Начальная категория
  },
  reducers: {
    setcategories: (state, action) => {
      state.category = action.payload; // Меняем категорию
    },
  },
});

// Экспортируем action и reducer
export const { setcategories } = filterSlice.actions;
export default filterSlice.reducer;