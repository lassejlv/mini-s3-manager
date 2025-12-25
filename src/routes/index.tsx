import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator, BreadcrumbPage } from '@/components/ui/breadcrumb'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Folder, File as FileIcon, Trash2, Upload, RefreshCw, Home, Copy, Eye, EyeOff } from 'lucide-react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/')({
  component: S3Manager,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      path: (search.path as string) || '',
    }
  },
})

function S3Manager() {
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: Route.fullPath })
  const { path } = useSearch({ from: Route.fullPath })
  const [uploading, setUploading] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [targetFolder, setTargetFolder] = useState(path)

  const {
    data: files,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['files'],
    queryFn: async () => {
      const res = await fetch('/api/files')
      if (!res.ok) throw new Error('Failed to fetch files')
      return res.json()
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async ({ file, folder }: { file: File; folder: string }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', folder)
      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('File uploaded successfully')
      queryClient.invalidateQueries({ queryKey: ['files'] })
    },
    onError: () => {
      toast.error('Failed to upload file')
    },
    onSettled: () => {
      setUploading(false)
      setUploadDialogOpen(false)
      setSelectedFile(null)
      setTargetFolder(path)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(`/api/files/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Delete failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('File deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['files'] })
    },
    onError: () => {
      toast.error('Failed to delete file')
    },
  })

  const handleUploadSubmit = () => {
    if (!selectedFile) return
    setUploading(true)
    uploadMutation.mutate({ file: selectedFile, folder: targetFolder })
  }

  // Filter files based on current path
  const currentPath = path.endsWith('/') || path === '' ? path : `${path}/`
  const allFiles = files?.contents || []

  // Create a set of folders and files for the current level
  const items = new Map<string, any>()

  allFiles.forEach((file: any) => {
    if (!file.key.startsWith(currentPath)) return

    const relativeKey = file.key.slice(currentPath.length)
    const parts = relativeKey.split('/')

    if (parts.length > 1) {
      // It's a folder (or file in a subfolder)
      const folderName = parts[0]
      if (!items.has(folderName)) {
        items.set(folderName, {
          key: folderName,
          isFolder: true,
          fullPath: currentPath + folderName,
        })
      }
    } else if (parts[0] !== '') {
      // It's a file in the current folder
      items.set(parts[0], {
        ...file,
        isFolder: false,
        name: parts[0],
      })
    }
  })

  const displayedItems = Array.from(items.values()).sort((a, b) => {
    if (a.isFolder === b.isFolder) return a.key.localeCompare(b.key)
    return a.isFolder ? -1 : 1
  })

  const breadcrumbs = path.split('/').filter(Boolean)

  const handleNavigate = (newPath: string) => {
    navigate({ search: { path: newPath } })
    setTargetFolder(newPath)
  }

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const res = await fetch('/api/config')
      if (!res.ok) throw new Error('Failed to fetch config')
      return res.json()
    },
  })

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const ConfigField = ({ label, value, isSecret = false }: { label: string; value: string; isSecret?: boolean }) => {
    const [show, setShow] = useState(false)
    return (
      <div className='space-y-2'>
        <Label>{label}</Label>
        <div className='flex gap-2'>
          <Input value={value} type={isSecret && !show ? 'password' : 'text'} readOnly className='font-mono' />
          {isSecret && (
            <Button variant='outline' size='icon' onClick={() => setShow(!show)}>
              {show ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
            </Button>
          )}
          <Button variant='outline' size='icon' onClick={() => copyToClipboard(value, label)}>
            <Copy className='h-4 w-4' />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className='container mx-auto p-8 max-w-4xl'>
      <Tabs defaultValue='files' className='w-full'>
        <TabsList className='grid w-full grid-cols-2 mb-8'>
          <TabsTrigger value='files'>Files</TabsTrigger>
          <TabsTrigger value='settings'>Settings</TabsTrigger>
        </TabsList>

        <TabsContent value='files'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between'>
              <div>
                <CardTitle>Mini S3 Manager</CardTitle>
                <CardDescription>
                  <Breadcrumb className='mt-2'>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink onClick={() => handleNavigate('')} className='cursor-pointer'>
                          <Home className='h-4 w-4' />
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      {breadcrumbs.map((crumb, index) => {
                        const crumbPath = breadcrumbs.slice(0, index + 1).join('/')
                        const isLast = index === breadcrumbs.length - 1

                        return (
                          <div key={crumbPath} className='flex items-center'>
                            <BreadcrumbItem>
                              {isLast ? (
                                <BreadcrumbPage>{crumb}</BreadcrumbPage>
                              ) : (
                                <BreadcrumbLink onClick={() => handleNavigate(crumbPath)} className='cursor-pointer'>
                                  {crumb}
                                </BreadcrumbLink>
                              )}
                            </BreadcrumbItem>
                            {!isLast && <BreadcrumbSeparator className='ml-2' />}
                          </div>
                        )
                      })}
                    </BreadcrumbList>
                  </Breadcrumb>
                </CardDescription>
              </div>
              <div className='flex gap-2 items-center'>
                <Button variant='outline' size='icon' onClick={() => refetch()} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>

                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setTargetFolder(path)}>
                      <Upload className='mr-2 h-4 w-4' />
                      Upload
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload File</DialogTitle>
                      <DialogDescription>Choose a file and specify the upload folder.</DialogDescription>
                    </DialogHeader>
                    <div className='grid gap-4 py-4'>
                      <div className='grid gap-2'>
                        <Label htmlFor='file'>File</Label>
                        <Input id='file' type='file' onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                      </div>
                      <div className='grid gap-2'>
                        <Label htmlFor='folder'>Folder Path</Label>
                        <Input id='folder' value={targetFolder} onChange={(e) => setTargetFolder(e.target.value)} placeholder='e.g. images/2024' />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleUploadSubmit} disabled={!selectedFile || uploading}>
                        {uploading ? 'Uploading...' : 'Upload'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className='text-red-500 text-center py-4'>Error loading files. Check your S3 configuration.</div>
              ) : isLoading ? (
                <div className='flex justify-center py-8'>
                  <RefreshCw className='h-8 w-8 animate-spin text-muted-foreground' />
                </div>
              ) : displayedItems.length === 0 ? (
                <div className='text-center py-8 text-muted-foreground'>{path ? 'Folder is empty.' : 'No files found in bucket.'}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Last Modified</TableHead>
                      <TableHead className='w-24 text-right'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedItems.map((item: any) => (
                      <TableRow key={item.key} className={item.isFolder ? 'cursor-pointer hover:bg-muted/50' : ''} onClick={() => item.isFolder && handleNavigate(item.fullPath)}>
                        <TableCell className='font-medium flex items-center gap-2'>
                          {item.isFolder ? <Folder className='h-4 w-4 text-yellow-500' /> : <FileIcon className='h-4 w-4 text-blue-500' />}
                          {item.name || item.key}
                        </TableCell>
                        <TableCell>{item.isFolder ? '-' : item.size ? (item.size / 1024).toFixed(2) + ' KB' : '-'}</TableCell>
                        <TableCell>{item.isFolder ? '-' : item.lastModified ? new Date(item.lastModified).toLocaleString() : '-'}</TableCell>
                        <TableCell className='text-right'>
                          {!item.isFolder && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  className='text-red-500 hover:text-red-700 hover:bg-red-50'
                                  disabled={deleteMutation.isPending}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className='h-4 w-4' />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the file
                                    <span className='font-mono bg-muted px-1 rounded mx-1 text-foreground'>{item.key}</span>
                                    from your S3 bucket.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(item.key)} className='bg-red-500 hover:bg-red-700'>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='settings'>
          <Card>
            <CardHeader>
              <CardTitle>S3 Configuration</CardTitle>
              <CardDescription>View your current S3 connection settings</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {configLoading ? (
                <div className='flex justify-center py-8'>
                  <RefreshCw className='h-8 w-8 animate-spin text-muted-foreground' />
                </div>
              ) : (
                <>
                  <ConfigField label='Access Key ID' value={config?.accessKeyId} />
                  <ConfigField label='Secret Access Key' value={config?.secretAccessKey} isSecret />
                  <ConfigField label='Region' value={config?.region} />
                  <ConfigField label='Bucket Name' value={config?.bucket} />
                  <ConfigField label='Endpoint' value={config?.endpoint} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
