import { mount } from '@vue/test-utils'
import AdminDataTable from './AdminDataTable.vue'

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'role', label: 'Role' },
]

const rows = [
  { name: 'Alice', email: 'alice@test.com', role: 'admin' },
  { name: 'Bob', email: 'bob@test.com', role: 'user' },
]

describe('AdminDataTable', () => {
  it('should render column headers', () => {
    const wrapper = mount(AdminDataTable, { props: { columns, rows } })
    const headers = wrapper.findAll('th')
    expect(headers).toHaveLength(3)
    expect(headers[0].text()).toContain('Name')
    expect(headers[1].text()).toContain('Email')
    expect(headers[2].text()).toContain('Role')
  })

  it('should render row data in cells', () => {
    const wrapper = mount(AdminDataTable, { props: { columns, rows } })
    const cells = wrapper.findAll('td')
    expect(cells[0].text()).toBe('Alice')
    expect(cells[1].text()).toBe('alice@test.com')
    expect(cells[2].text()).toBe('admin')
    expect(cells[3].text()).toBe('Bob')
  })

  it('should show empty state when rows is empty', () => {
    const wrapper = mount(AdminDataTable, { props: { columns, rows: [] } })
    expect(wrapper.text()).toContain('No results found')
    const emptyTd = wrapper.find('td[colspan]')
    expect(emptyTd.exists()).toBe(true)
  })

  it('should emit sort event when a sortable column header is clicked', async () => {
    const wrapper = mount(AdminDataTable, { props: { columns, rows } })
    const nameHeader = wrapper.findAll('th')[0]
    await nameHeader.trigger('click')
    expect(wrapper.emitted('sort')).toHaveLength(1)
    expect(wrapper.emitted('sort')![0]).toEqual(['name'])
  })

  it('should not emit sort event when a non-sortable column header is clicked', async () => {
    const wrapper = mount(AdminDataTable, { props: { columns, rows } })
    const roleHeader = wrapper.findAll('th')[2]
    await roleHeader.trigger('click')
    expect(wrapper.emitted('sort')).toBeUndefined()
  })

  it('should emit row-click event when a row is clicked', async () => {
    const wrapper = mount(AdminDataTable, { props: { columns, rows } })
    const firstRow = wrapper.findAll('tbody tr')[0]
    await firstRow.trigger('click')
    expect(wrapper.emitted('row-click')).toHaveLength(1)
    expect(wrapper.emitted('row-click')![0]).toEqual([rows[0]])
  })

  it('should show sort indicator for the active sorted column', () => {
    const wrapper = mount(AdminDataTable, {
      props: { columns, rows, sortBy: 'name', sortDir: 'asc' },
    })
    const nameHeader = wrapper.findAll('th')[0]
    expect(nameHeader.find('svg').exists()).toBe(true)

    const emailHeader = wrapper.findAll('th')[1]
    expect(emailHeader.find('svg').exists()).toBe(false)
  })
})
