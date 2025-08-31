const getUsers = (req, res) => {
  res.json([{ id: 1, name: 'John Doe' }, { id: 2, name: 'Jane Smith' }]);
};

const getUserById = (req, res) => {
  const { id } = req.params;
  res.json({ id: parseInt(id), name: 'User ' + id });
};

const createUser = (req, res) => {
  const { name, email } = req.body;
  res.status(201).json({ id: 3, name, email, message: 'User created successfully' });
};

module.exports = { getUsers, getUserById, createUser };