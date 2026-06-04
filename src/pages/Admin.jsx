import { useMemo, useState } from "react";

const roles = ["Viewer", "Editor", "Admin"];
const processes = ["전체", "CELL", "MODULE", "PACK", "BMS"];

export default function Admin({ users, onUpdateUsers, searchText }) {
  const [filter, setFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState("Viewer");
  const [newPerm, setNewPerm] = useState("CELL");

  const filtered = useMemo(() => {
    return users.filter((user) => {
      const permsText = Array.isArray(user.perms)
        ? user.perms.join(",")
        : String(user.perms ?? "");
      const text = (
        String(user.name ?? "") +
        String(user.role ?? "") +
        permsText
      ).toLowerCase();
      const matchesSearch = searchText
        ? text.includes(String(searchText).toLowerCase())
        : true;
      const matchesFilter = filter === "전체" || user.role === filter;
      return matchesSearch && matchesFilter;
    });
  }, [users, searchText, filter]);

  const handleAddUser = () => {
    if (!selectedUser) return;
    const updated = users.map((user) => {
      if (user.name !== selectedUser.name) return user;
      const perms = Array.from(new Set([...user.perms, newPerm]));
      return { ...user, role: newRole, perms };
    });
    onUpdateUsers(updated);
    setSelectedUser(null);
  };

  const handleRemovePerm = (userName, perm) => {
    const updated = users.map((user) => {
      if (user.name !== userName) return user;
      return { ...user, perms: user.perms.filter((item) => item !== perm) };
    });
    onUpdateUsers(updated);
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-text-default">
            권한 관리
          </h1>
          <p className="mt-2 text-sm text-text-subtle">
            사용자별 공정 접근 권한을 세밀하게 제어합니다.
          </p>
        </div>
        <button
          type="button"
          className="btn-base btn-primary"
          onClick={() => setFilter("전체")}
        >
          모든 사용자 보기
        </button>
      </header>

      <div className="card p-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-2 text-sm text-text-subtle">
            역할 필터
            <select
              className="input-base"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
              <option value="전체">전체</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            사용자 검색
            <input
              className="input-base"
              value={searchText}
              placeholder="사용자명 검색..."
              disabled
            />
          </label>
          <div className="flex items-end justify-end">
            <span className="badge badge-primary">{filtered.length}명</span>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full text-left text-sm">
          <thead className="table-header">
            <tr>
              <th className="px-4 py-3 text-text-subtle">사용자명</th>
              <th className="px-4 py-3 text-text-subtle">할당된 권한 세트</th>
              <th className="px-4 py-3 text-text-subtle text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr
                key={user.name}
                className="border-t border-border-base hover:bg-fill-active"
              >
                <td className="px-4 py-4 text-text-default">{user.name}</td>
                <td className="px-4 py-4 text-text-subtle">
                  <div className="flex flex-wrap gap-2">
                    {user.perms.map((perm) => (
                      <span key={perm} className="badge badge-primary">
                        {perm}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    type="button"
                    className="btn-base btn-ghost text-sm"
                    onClick={() => setSelectedUser(user)}
                  >
                    권한 편집
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedUser ? (
        <div className="card rounded-3xl border border-border-base p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-default">
                {selectedUser.name} 권한 편집
              </h2>
              <p className="text-sm text-text-subtle">
                선택한 사용자에 대한 역할과 공정 권한을 업데이트합니다.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3 lg:w-[60%]">
              <label className="space-y-2 text-sm text-text-subtle">
                역할
                <select
                  className="input-base"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-text-subtle">
                추가 공정
                <select
                  className="input-base"
                  value={newPerm}
                  onChange={(e) => setNewPerm(e.target.value)}
                >
                  {processes
                    .filter((item) => item !== "전체")
                    .map((process) => (
                      <option key={process} value={process}>
                        {process}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-base btn-primary"
                onClick={handleAddUser}
              >
                저장
              </button>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="text-sm text-text-subtle">현재 권한</div>
            <div className="flex flex-wrap gap-2">
              {selectedUser.perms.map((perm) => (
                <button
                  key={perm}
                  type="button"
                  className="badge badge-danger"
                  onClick={() => handleRemovePerm(selectedUser.name, perm)}
                >
                  {perm} 삭제
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
